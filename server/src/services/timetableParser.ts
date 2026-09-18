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

export function normalizeTime(raw: any): string | null {
  if (!raw) return null;
  let str = String(raw).trim();
  // Handle numbers from Excel (e.g., decimal time representation or 900)
  if (!str.includes(':')) {
    if (/^\d{3,4}$/.test(str)) {
      const padded = str.padStart(4, '0');
      str = `${padded.slice(0, 2)}:${padded.slice(2)}`;
    } else {
      return null;
    }
  }
  const match = str.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (!match) return null;
  const h = match[1].padStart(2, '0');
  const m = match[2];
  return `${h}:${m}`;
}

export function parseTimetableBuffer(
  buffer: Buffer,
  fileType: 'csv' | 'xlsx'
): TimetableParseResult {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Invalid spreadsheet: No sheets found in workbook.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Invalid spreadsheet: First sheet is empty or corrupted.');
  }

  // Parse rows with an upper bound of 500 rows to prevent DOS payload expansion
  const rawJson: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  const jsonData = rawJson.slice(0, 500);

  const validRows: ParsedTimetableRow[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (rawJson.length > 500) {
    warnings.push({
      rowNumber: 501,
      message: `File contains ${rawJson.length} rows. Only the first 500 rows were parsed.`,
    });
  }

  jsonData.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1

    // Find keys case-insensitively
    const keys = Object.keys(row);
    const findVal = (pattern: RegExp) => {
      const k = keys.find((key) => pattern.test(key));
      return k ? String(row[k]).trim() : '';
    };

    const dayRaw = findVal(/day/i);
    const startRaw = findVal(/start/i);
    const endRaw = findVal(/end/i);
    const subjectRaw = findVal(/sub(ject)?[\s_-]?(code)?/i);
    const facultyRaw = findVal(/faculty|teacher|prof/i);
    const roomRaw = findVal(/room|hall|lab/i);
    const typeRaw = findVal(/type|mode/i).toUpperCase();

    // 1. Validate Day
    const dayParsed = parseDay(dayRaw);
    if (!dayParsed) {
      errors.push({
        rowNumber,
        field: 'Day',
        message: `Invalid day "${dayRaw}". Expected Monday to Saturday.`,
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
