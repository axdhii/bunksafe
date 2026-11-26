import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { calculateAttendance } from '../utils/attendanceEngine.js';
import { parseTimetableBuffer, normalizeTime } from '../services/timetableParser.js';
import { batchMatches, isValidBatch } from '../utils/batch.js';
import { isNameMatching } from '../controllers/authController.js';
import { isIncompleteSchedule, mergeConsecutiveScheduleEntries } from '../services/aiTimetableParser.js';
import { isValidAttendanceDate } from '../controllers/attendanceController.js';

describe('Bunk math edge cases', () => {
  it('never shows a percentage at the threshold while the student is below it (96/113)', () => {
    const r = calculateAttendance(96, 113, 85); // 84.96%
    expect(r.percentage).toBe(84.9);
    expect(r.risk).toBe('CRITICAL');
    expect(r.recoveryRequired).toBe(1);
    expect(r.safeSkips).toBe(0);
  });

  it('exactly at the threshold is not critical (17/20 at 85%)', () => {
    const r = calculateAttendance(17, 20, 85);
    expect(r.percentage).toBe(85);
    expect(r.risk).toBe('WARNING');
    expect(r.recoveryRequired).toBe(0);
  });

  it('a 100% threshold never yields Infinity/NaN', () => {
    const r = calculateAttendance(9, 10, 100);
    expect(Number.isFinite(r.recoveryRequired)).toBe(true);
    expect(r.risk).toBe('CRITICAL');
    const z = calculateAttendance(5, 10, 0);
    expect(Number.isFinite(z.safeSkips)).toBe(true);
  });

  it('every reported value is finite across a grid of inputs', () => {
    for (const t of [50, 75, 85, 99.9])
      for (let c = 0; c <= 60; c++)
        for (let a = 0; a <= c; a++) {
          const r = calculateAttendance(a, c, t);
          for (const v of [r.percentage, r.safeSkips, r.recoveryRequired, r.nextIfAttended, r.nextIfMissed]) {
            expect(Number.isFinite(v)).toBe(true);
          }
          // Recovery claim must actually reach the threshold, and skipping the safe count must not drop below it
          if (r.recoveryRequired > 0) expect((a + r.recoveryRequired) / (c + r.recoveryRequired)).toBeGreaterThanOrEqual(t / 100 - 1e-9);
          if (c > 0 && r.risk !== 'CRITICAL') expect(a / (c + r.safeSkips)).toBeGreaterThanOrEqual(t / 100 - 1e-9);
          expect(r.risk === 'CRITICAL').toBe(c > 0 && a / c < t / 100 - 1e-12);
        }
  });
});

describe('Timetable time parsing', () => {
  it.each([
    ['09:00', '09:00'], ['9:00', '09:00'], ['900', '09:00'], ['9.30', '09:30'],
    ['2:00 PM', '14:00'], ['12:30 PM', '12:30'], ['12:05 AM', '00:05'], ['11.10AM', '11:10'],
    [0.375, '09:00'], [0.6041666667, '14:30'],
  ])('%s -> %s', (input, out) => expect(normalizeTime(input)).toBe(out));

  it.each(['25:00', '13:00 PM', 'abc', '', null, '9:75'])('rejects %s', (input) => expect(normalizeTime(input)).toBeNull());

  it('reads real Excel time cells, batch column and does not flag parallel labs as conflicts', () => {
    const ws = xlsx.utils.aoa_to_sheet([
      ['Day', 'Start Time', 'End Time', 'Subject Code', 'Room', 'Type', 'Batch', 'Attendance Notes'],
      ['Monday', 0.375, 0.416666667, '21cs51', 'LH1', 'Lecture', '', 'x'],
      ['Monday', 0.458333333, 0.541666667, '21CSL1', 'Lab1', 'Lab', 'A1', 'x'],
      ['Monday', 0.458333333, 0.541666667, '21CSL2', 'Lab2', 'Lab', 'A2', 'x'],
      ['Sunday', '2:00 PM', '3:00 PM', '21CS52', 'LH1', 'Lecture', 'ALL', 'x'],
    ]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'T');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = parseTimetableBuffer(buf, 'xlsx');
    expect(r.errors).toEqual([]);
    expect(r.validRows.map((v) => [v.startTime, v.endTime, v.batch, v.subjectCode])).toEqual([
      ['09:00', '10:00', 'ALL', '21CS51'],
      ['11:00', '13:00', 'A1', '21CSL1'],
      ['11:00', '13:00', 'A2', '21CSL2'],
      ['14:00', '15:00', 'ALL', '21CS52'],
    ]);
    expect(r.warnings.some((w) => w.message.includes('conflict'))).toBe(false);
  });

  it('stops parsing after 500 rows', () => {
    const rows = ['Day,StartTime,EndTime,SubjectCode,Room'];
    for (let i = 0; i < 2000; i++) rows.push('Monday,09:00,10:00,CS1,R1');
    const r = parseTimetableBuffer(Buffer.from(rows.join('\n')), 'csv');
    expect(r.totalRows).toBe(500);
    expect(r.warnings.some((w) => w.message.includes('500 rows'))).toBe(true);
  });
});

describe('Lab batches', () => {
  it('matches batches by number across naming schemes', () => {
    expect(batchMatches('ALL', null)).toBe(true);
    expect(batchMatches(null, 'A1')).toBe(true);
    expect(batchMatches('A1', 'A1')).toBe(true);
    expect(batchMatches('A1', 'B1')).toBe(true);
    expect(batchMatches('A2', 'B1')).toBe(false);
    expect(batchMatches('B2', null)).toBe(false); // no batch -> no credit for parallel labs
  });
  it('validates batch codes', () => {
    expect(['A1', 'b2', '1'].every(isValidBatch)).toBe(true);
    expect(['ALL', 'AB1', '', 'A12', 3].some(isValidBatch)).toBe(false);
  });
});

describe('Roster name verification', () => {
  it('requires every word of the name, in any order', () => {
    expect(isNameMatching('Rahul Kumar Sharma', 'rahul kumar sharma')).toBe(true);
    expect(isNameMatching('Rahul Kumar Sharma', 'Sharma, Rahul Kumar')).toBe(true);
    expect(isNameMatching('Rahul Kumar Sharma', 'Kumar')).toBe(false);
    expect(isNameMatching('Rahul Kumar Sharma', 'Rahul Sharma')).toBe(false);
    expect(isNameMatching('Rahul Kumar Sharma', 'Rahul Kumar Sharma Extra')).toBe(false);
    expect(isNameMatching('', '')).toBe(false);
  });
});

describe('Attendance dates', () => {
  it('accepts real past dates only', () => {
    expect(isValidAttendanceDate('2026-11-26', '2026-11-26')).toBe(true);
    expect(isValidAttendanceDate('2024-02-29', '2026-11-26')).toBe(true);
    for (const bad of ['2026-11-27', '2026-13-01', '2025-02-29', '26-11-2026', 'today', null]) {
      expect(isValidAttendanceDate(bad, '2026-11-26')).toBe(false);
    }
  });
});

describe('AI scan completeness gate', () => {
  const slot = (day: number, start: string) => ({ dayOfWeek: day, startTime: start, endTime: start.replace(':00', ':50'), subjectCode: `S${day}${start}` });
  it('rejects many slots on too few days, and few slots on many days', () => {
    const twoDays = Array.from({ length: 20 }, (_, i) => slot(1 + (i % 2), `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:00`));
    expect(isIncompleteSchedule(mergeConsecutiveScheduleEntries(twoDays))).toBe(true);
    const fewSlots = [1, 2, 3, 4, 5].map((d) => slot(d, '09:00'));
    expect(isIncompleteSchedule(fewSlots)).toBe(true);
    const full = Array.from({ length: 20 }, (_, i) => slot(1 + (i % 5), `${String(8 + Math.floor(i / 5)).padStart(2, '0')}:00`));
    expect(isIncompleteSchedule(full)).toBe(false);
  });
});
