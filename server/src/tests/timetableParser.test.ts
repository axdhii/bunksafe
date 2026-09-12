import { describe, it, expect } from 'vitest';
import { parseTimetableBuffer } from '../services/timetableParser.js';

describe('Timetable Parser - Validation & Preview', () => {
  it('parses valid CSV timetable data correctly', () => {
    const csvContent = `Day,StartTime,EndTime,SubjectCode,Faculty,Room,Type
Monday,09:00,10:00,21CS51,Dr. Raman,LH-301,LECTURE
Monday,10:00,11:00,21CS52,Prof. Sharma,LH-301,LECTURE
Tuesday,14:00,16:00,21CSL56,Dr. Raman,Lab-2,LAB`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const result = parseTimetableBuffer(buffer, 'csv');

    expect(result.errors.length).toBe(0);
    expect(result.validRows.length).toBe(3);
    expect(result.validRows[0].dayOfWeek).toBe(1);
    expect(result.validRows[0].subjectCode).toBe('21CS51');
    expect(result.validRows[0].startTime).toBe('09:00');
    expect(result.validRows[0].endTime).toBe('10:00');
    expect(result.validRows[2].type).toBe('LAB');
  });

  it('detects invalid day, invalid time format, and end before start errors', () => {
    const csvContent = `Day,StartTime,EndTime,SubjectCode,Faculty,Room,Type
Funday,09:00,10:00,21CS51,Dr. Raman,LH-301,LECTURE
Monday,25:00,10:00,21CS52,Prof. Sharma,LH-301,LECTURE
Monday,11:00,09:00,21CS53,Dr. Iyer,LH-301,LECTURE
Tuesday,09:00,10:00,,Dr. Raman,LH-301,LECTURE`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const result = parseTimetableBuffer(buffer, 'csv');

    expect(result.errors.length).toBe(4);
    expect(result.errors[0].message).toContain('Invalid day "Funday"');
    expect(result.errors[1].message).toContain('Invalid start time');
    expect(result.errors[2].message).toContain('must be after start time');
    expect(result.errors[3].message).toContain('Subject code is required');
  });

  it('generates warnings for time conflicts/overlaps', () => {
    const csvContent = `Day,StartTime,EndTime,SubjectCode,Faculty,Room,Type
Monday,09:00,10:30,21CS51,Dr. Raman,LH-301,LECTURE
Monday,10:00,11:00,21CS52,Prof. Sharma,LH-302,LECTURE`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const result = parseTimetableBuffer(buffer, 'csv');

    expect(result.validRows.length).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('Time slot conflict on Monday');
  });
});
