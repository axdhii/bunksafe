import * as xlsx from 'xlsx';

export interface ParsedTimetableRow {
  rowNumber: number;
  dayOfWeek: number; // 1 to 7
  dayName: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  subjectCode: string;
  faculty?: string;
  room?: string;
  type: 'LECTURE' | 'LAB' | 'TUTORIAL';
  batch: string; // "ALL" or a lab batch like "A1"
}

export interface ValidationError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ValidationWarning {
  rowNumber: number;
  message: string;
}

export interface TimetableParseResult {
  validRows: ParsedTimetableRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  totalRows: number;
}

const DAY_MAP: Record<string, number> = {
  monday: 1, mon: 1, '1': 1,
  tuesday: 2, tue: 2, tues: 2, '2': 2,
  wednesday: 3, wed: 3, '3': 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, '4': 4,
  friday: 5, fri: 5, '5': 5,
  saturday: 6, sat: 6, '6': 6,
  sunday: 7, sun: 7, '7': 7,
};

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function parseDay(raw: any): { dayOfWeek: number; dayName: string } | null {
  if (!raw) return null;
  const str = String(raw).trim().toLowerCase();
  const dayOfWeek = DAY_MAP[str];
  if (!dayOfWeek) return null;
  return { dayOfWeek, dayName: DAY_NAMES[dayOfWeek] };
}

/**
 * Accepts "09:00", "9:00", "900", "9.30", "2:00 PM", and Excel time cells (fractions of a day, e.g. 0.375).
 * Returns "HH:MM" (24-hour) or null.
 */
export function normalizeTime(raw: any): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Excel stores times as a fraction of a day
  if (typeof raw === 'number' && raw > 0 && raw < 1) {
    const total = Math.round(raw * 24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  let str = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const meridiem = str.match(/(AM|PM|A\.M\.|P\.M\.)$/)?.[1];
  if (meridiem) str = str.slice(0, -meridiem.length);
  str = str.replace('.', ':');
  if (/^\d{3,4}$/.test(str)) str = `${str.padStart(4, '0').slice(0, 2)}:${str.padStart(4, '0').slice(2)}`;
  else if (/^\d{1,2}$/.test(str) && meridiem) str = `${str}:00`;

  const match = str.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  let h = Number(match[1]);
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem.startsWith('P') && h !== 12) h += 12;
    if (meridiem.startsWith('A') && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

export function parseTimetableBuffer(
  buffer: Buffer,
  fileType: 'csv' | 'xlsx'
): TimetableParseResult {
  // sheetRows stops parsing after the header + 500 data rows, so huge sheets cannot exhaust memory
  const workbook = xlsx.read(buffer, { type: 'buffer', sheetRows: 502 });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Invalid spreadsheet: No sheets found in workbook.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Invalid spreadsheet: First sheet is empty or corrupted.');
  }

  const rawJson: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  const jsonData = rawJson.slice(0, 500);

  const validRows: ParsedTimetableRow[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (rawJson.length > 500) {
    warnings.push({
      rowNumber: 501,
      message: 'File contains more than 500 rows. Only the first 500 rows were parsed.',
    });
  }

  jsonData.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1

    // Find keys case-insensitively and guard against prototype pollution
    const keys = Object.keys(row);
    const findVal = (pattern: RegExp) => {
      const k = keys.find((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && pattern.test(key));
      return k && Object.prototype.hasOwnProperty.call(row, k) ? String(row[k]).trim() : '';
    };
    // Same lookup, but keeps numbers as-is (Excel time cells arrive as fractions of a day)
    const findRaw = (pattern: RegExp) => {
      const k = keys.find((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && pattern.test(key));
      return k && Object.prototype.hasOwnProperty.call(row, k) ? row[k] : '';
    };

    const dayRaw = findVal(/day/i);
    const startRaw = findRaw(/start|from/i);
    const endRaw = findRaw(/^\s*end|end[\s_-]*time|^\s*to\s*$/i);
    const subjectRaw = findVal(/sub(ject)?[\s_-]?(code)?/i).toUpperCase();
    const facultyRaw = findVal(/faculty|teacher|prof/i);
    const roomRaw = findVal(/room|hall|venue/i);
    const typeRaw = findVal(/type|mode/i).toUpperCase();
    const batchRaw = findVal(/batch|group/i).toUpperCase();

    // 1. Validate Day
    const dayParsed = parseDay(dayRaw);
    if (!dayParsed) {
      errors.push({
        rowNumber,
        field: 'Day',
        message: `Invalid day "${dayRaw}". Expected Monday to Sunday.`,
      });
      return;
    }

    // 2. Validate Start Time
    const startTime = normalizeTime(startRaw);
    if (!startTime) {
      errors.push({
        rowNumber,
        field: 'StartTime',
        message: `Invalid start time "${startRaw}". Expected HH:MM format.`,
      });
      return;
    }

    // 3. Validate End Time
    const endTime = normalizeTime(endRaw);
    if (!endTime) {
      errors.push({
        rowNumber,
        field: 'EndTime',
        message: `Invalid end time "${endRaw}". Expected HH:MM format.`,
      });
      return;
    }

    if (startTime >= endTime) {
      errors.push({
        rowNumber,
        field: 'EndTime',
        message: `End time (${endTime}) must be after start time (${startTime}).`,
      });
      return;
    }

    // 4. Validate Subject Code
    if (!subjectRaw) {
      errors.push({
        rowNumber,
        field: 'SubjectCode',
        message: 'Subject code is required.',
      });
      return;
    }

    // 5. Type
    let classType: 'LECTURE' | 'LAB' | 'TUTORIAL' = 'LECTURE';
    if (typeRaw.includes('LAB')) classType = 'LAB';
    else if (typeRaw.includes('TUT')) classType = 'TUTORIAL';

    const batch = !batchRaw || batchRaw === 'ALL' ? 'ALL' : batchRaw;
    if (batch !== 'ALL' && !/^[A-Z]?\d$/.test(batch)) {
      errors.push({ rowNumber, field: 'Batch', message: `Invalid batch "${batchRaw}". Use ALL, or a code like A1 / B2.` });
      return;
    }

    // Warnings
    if (!roomRaw) {
      warnings.push({
        rowNumber,
        message: `No room specified for ${subjectRaw} on ${dayParsed.dayName}.`,
      });
    }

    validRows.push({
      rowNumber,
      dayOfWeek: dayParsed.dayOfWeek,
      dayName: dayParsed.dayName,
      startTime,
      endTime,
      subjectCode: subjectRaw,
      faculty: facultyRaw || undefined,
      room: roomRaw || undefined,
      type: classType,
      batch,
    });
  });

  // PERF-9: Check for internal conflicts/overlaps in O(n log n) by grouping by day and sorting by startTime
  const rowsByDay = new Map<number, typeof validRows>();
  for (const row of validRows) {
    const list = rowsByDay.get(row.dayOfWeek);
    if (!list) {
      rowsByDay.set(row.dayOfWeek, [row]);
    } else {
      list.push(row);
    }
  }

  for (const [, dayRows] of rowsByDay) {
    const sorted = [...dayRows].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.rowNumber - b.rowNumber);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (b.startTime >= a.endTime) {
          break;
        }
        if (a.batch !== 'ALL' && b.batch !== 'ALL' && a.batch !== b.batch) continue; // parallel split lab
        const first = a.rowNumber < b.rowNumber ? a : b;
        const second = a.rowNumber < b.rowNumber ? b : a;
        warnings.push({
          rowNumber: second.rowNumber,
          message: `Time slot conflict on ${first.dayName} between row ${first.rowNumber} (${first.startTime}-${first.endTime}) and row ${second.rowNumber} (${second.startTime}-${second.endTime}).`,
        });
      }
    }
  }

  return {
    validRows,
    errors,
    warnings,
    totalRows: jsonData.length,
  };
}
