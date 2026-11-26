/** Lab batch codes look like "A1", "B2" or just "1". */
export function isValidBatch(batch: unknown): boolean {
  return typeof batch === 'string' && /^[A-Z]?\d$/i.test(batch.trim());
}

/**
 * Whether a timetable slot applies to a student's batch. Sections name batches A1/A2 or B1/B2,
 * so batches are matched by their number. A student with no batch only gets whole-class slots.
 */
export function batchMatches(entryBatch: string | null | undefined, studentBatch: string | null | undefined): boolean {
  const e = (entryBatch || 'ALL').trim().toUpperCase();
  if (e === 'ALL') return true;
  const s = (studentBatch || '').trim().toUpperCase();
  if (!s) return false;
  return e === s || e.slice(-1) === s.slice(-1);
}
