import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { parseTimetableBuffer, normalizeTime } from '../services/timetableParser.js';
import { parseTimetableImageWithGemini } from '../services/aiTimetableParser.js';
import { parseThreshold } from './academicController.js';
import { logAuditAction } from '../services/auditService.js';

const BREAK_TYPES = ['INTERVAL', 'LUNCH', 'BREAK'];

type EntryData = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  title: string | null;
  faculty: string | null;
  room: string | null;
  type: string;
  batch: string;
};

/** Normalises one incoming slot; returns null when the day or times are unusable. */
function cleanSlot(e: any, subjectId: string | null): EntryData | null {
  const dayOfWeek = Number(e.dayOfWeek);
  const startTime = normalizeTime(e.startTime);
  const endTime = normalizeTime(e.endTime);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 || !startTime || !endTime || startTime >= endTime) {
    return null;
  }
  const type = String(e.type || 'LECTURE').trim().toUpperCase();
  const isBreak = BREAK_TYPES.includes(type);
  return {
    dayOfWeek,
    startTime,
    endTime,
    subjectId: isBreak ? null : subjectId,
    title: e.title ? String(e.title).trim() : isBreak ? (type === 'LUNCH' ? 'Lunch Break' : 'Tea / Short Break') : (subjectId ? null : e.subjectName ? String(e.subjectName).trim() : null),
    faculty: e.faculty ? String(e.faculty).trim() : null,
    room: e.room ? String(e.room).trim() : null,
    type,
    batch: e.batch ? String(e.batch).trim().toUpperCase() : 'ALL',
  };
}

/**
 * Replaces a timetable's slots while keeping the ids of slots that still exist (same day, times and
 * batch), so past attendance stays linked to them. Only slots that were really removed are deleted.
 */
async function replaceTimetableEntries(timetableId: string, entries: EntryData[]) {
  const slotKey = (e: { dayOfWeek: number; startTime: string; endTime: string; batch: string | null }) =>
    `${e.dayOfWeek}|${e.startTime}|${e.endTime}|${e.batch || 'ALL'}`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.timetableEntry.findMany({ where: { timetableId } });
    const pool = new Map<string, typeof existing>();
    for (const e of existing) pool.set(slotKey(e), [...(pool.get(slotKey(e)) || []), e]);

    const toCreate: EntryData[] = [];
    for (const entry of entries) {
      const candidates = pool.get(slotKey(entry)) || [];
      // Prefer the old slot with the same subject (parallel labs share day/time/batch keys rarely, but can)
      const idx = Math.max(0, candidates.findIndex((c) => c.subjectId === entry.subjectId));
      const match = candidates.splice(idx, 1)[0];
      if (match) await tx.timetableEntry.update({ where: { id: match.id }, data: entry });
      else toCreate.push(entry);
    }

    const leftover = [...pool.values()].flat().map((e) => e.id);
    if (leftover.length) await tx.timetableEntry.deleteMany({ where: { id: { in: leftover } } });
    if (toCreate.length) await tx.timetableEntry.createMany({ data: toCreate.map((e) => ({ ...e, timetableId })) });
  }, { timeout: 30000 });
}

export async function getStudentTimetable(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.user!.studentId!;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const timetable = await prisma.timetable.findFirst({
      where: {
        sectionId: student.sectionId,
        semesterId: student.semesterId,
        branchId: student.branchId,
        isActive: true,
      },
      include: {
        entries: {
          include: { subject: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    res.json({
      timetableId: timetable?.id || null,
      entries: timetable?.entries || [],
    });
  } catch (error: any) {
    console.error('getStudentTimetable error:', error);
    res.status(500).json({ error: 'Failed to retrieve timetable.' });
  }
}

export async function getSectionTimetable(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId, semesterId, branchId } = req.query;

    if (!sectionId || !semesterId || !branchId) {
      res.status(400).json({ error: 'sectionId, semesterId, and branchId are required.' });
      return;
    }

    const timetable = await prisma.timetable.findFirst({
      where: {
        sectionId: String(sectionId),
        semesterId: String(semesterId),
        branchId: String(branchId),
        isActive: true,
      },
      include: {
        entries: {
          include: { subject: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    res.json({
      timetableId: timetable?.id || null,
      entries: timetable?.entries || [],
    });
  } catch (error: any) {
    console.error('getSectionTimetable error:', error);
    res.status(500).json({ error: 'Failed to retrieve timetable.' });
  }
}

export async function previewTimetableUpload(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Please upload a CSV or Excel (.xlsx) file.' });
      return;
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      res.status(400).json({ error: 'Unsupported file format. Please provide a .csv or .xlsx file.' });
      return;
    }

    const parseResult = parseTimetableBuffer(file.buffer, ext);
    res.json(parseResult);
  } catch (error: any) {
    console.error('previewTimetableUpload error:', error);
    res.status(400).json({ error: 'Could not read that file. Please check it is a valid CSV or .xlsx timetable.' });
  }
}

export async function confirmTimetableImport(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId, semesterId, branchId, academicYearId, entries } = req.body;

    if (!sectionId || !semesterId || !branchId || !Array.isArray(entries)) {
      res.status(400).json({ error: 'sectionId, semesterId, branchId, and entries array are required.' });
      return;
    }

    // Resolve academic year if not provided
    let acId = academicYearId;
    if (!acId) {
      const currentYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      if (!currentYear) {
        res.status(400).json({ error: 'No active academic year found in system.' });
        return;
      }
      acId = currentYear.id;
    }

    // Resolve subjects in this semester & branch
    const subjects = await prisma.subject.findMany({
      where: { semesterId, branchId },
    });
    const subjectMap = new Map<string, string>();
    subjects.forEach((s) => subjectMap.set(s.code.toUpperCase(), s.id));

    // Validate subjects for non-break entries
    const missingCodes = new Set<string>();
    for (const e of entries) {
      const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(e.type?.toUpperCase());
      if (!isBreak && e.subjectCode) {
        const code = String(e.subjectCode).trim().toUpperCase();
        if (!subjectMap.has(code)) {
          missingCodes.add(code);
        }
      }
    }

    if (missingCodes.size > 0) {
      res.status(400).json({
        error: `The following subject codes do not exist for this semester/branch: ${Array.from(missingCodes).join(', ')}. Please create them first.`,
      });
      return;
    }

    // Find or create timetable
    let timetable = await prisma.timetable.findFirst({
      where: {
        sectionId,
        semesterId,
        branchId,
        isActive: true,
      },
    });

    if (!timetable) {
      timetable = await prisma.timetable.create({
        data: {
          academicYearId: acId,
          sectionId,
          semesterId,
          branchId,
          isActive: true,
        },
      });
    }

    const entriesData: EntryData[] = [];
    const invalidRows: number[] = [];
    entries.forEach((e: any, i: number) => {
      const isBreak = BREAK_TYPES.includes(String(e.type || '').toUpperCase());
      const code = e.subjectCode ? String(e.subjectCode).trim().toUpperCase() : null;
      const subjectId = isBreak ? null : (code ? subjectMap.get(code) : subjects.find((s) => s.id === e.subjectId)?.id) || null;
      const slot = cleanSlot(e, subjectId);
      if (slot) entriesData.push(slot);
      else invalidRows.push(i + 1);
    });

    if (invalidRows.length > 0) {
      res.status(400).json({
        error: `Entries ${invalidRows.slice(0, 10).join(', ')} have an invalid day or time (use HH:MM, start before end).`,
      });
      return;
    }

    await replaceTimetableEntries(timetable.id, entriesData);

    await logAuditAction({
      actorEmail: req.user!.email || 'admin',
      actorRole: 'ADMIN',
      action: 'TIMETABLE_SAVED',
      targetEntity: 'Timetable',
      targetId: timetable.id,
      details: {
        sectionId,
        semesterId,
        branchId,
        entryCount: entries.length,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Successfully saved ${entries.length} timetable entries.`,
      timetableId: timetable.id,
    });
  } catch (error: any) {
    console.error('confirmTimetableImport error:', error);
    res.status(500).json({ error: 'Failed to import timetable entries.' });
  }
}

export async function saveManualTimetable(req: Request, res: Response): Promise<void> {
  return confirmTimetableImport(req, res);
}

export async function saveTimetableSlot(req: Request, res: Response): Promise<void> {
  try {
    const { id, sectionId, semesterId, branchId, dayOfWeek, startTime, endTime, subjectId, title, faculty, room, type, batch } = req.body;

    if (!sectionId || !semesterId || !branchId || !dayOfWeek || !startTime || !endTime) {
      res.status(400).json({ error: 'Missing required slot details (section, semester, branch, day, start/end time).' });
      return;
    }

    const isBreak = BREAK_TYPES.includes(String(type || '').toUpperCase());
    if (!isBreak && !subjectId) {
      res.status(400).json({ error: 'Subject is required for class slots.' });
      return;
    }
    if (!isBreak) {
      const subject = await prisma.subject.findUnique({ where: { id: String(subjectId) } });
      if (!subject || subject.semesterId !== semesterId || subject.branchId !== branchId) {
        res.status(400).json({ error: 'Subject does not belong to this semester and branch.' });
        return;
      }
    }
    const slot = cleanSlot({ dayOfWeek, startTime, endTime, title, faculty, room, type, batch }, isBreak ? null : String(subjectId));
    if (!slot) {
      res.status(400).json({ error: 'Invalid day or time. Use HH:MM and make sure the class ends after it starts.' });
      return;
    }

    // Find active academic year
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!currentYear) {
      res.status(400).json({ error: 'No active academic year found in system.' });
      return;
    }

    // Find or create timetable
    let timetable = await prisma.timetable.findFirst({
      where: { sectionId, semesterId, branchId, isActive: true },
    });

    if (!timetable) {
      timetable = await prisma.timetable.create({
        data: {
          academicYearId: currentYear.id,
          sectionId,
          semesterId,
          branchId,
          isActive: true,
        },
      });
    }

    let entry;
    if (id) {
      const current = await prisma.timetableEntry.findUnique({ where: { id: String(id) } });
      if (!current || current.timetableId !== timetable.id) {
        res.status(404).json({ error: 'Timetable slot not found in this section.' });
        return;
      }
      entry = await prisma.timetableEntry.update({ where: { id: current.id }, data: slot });
    } else {
      entry = await prisma.timetableEntry.create({ data: { ...slot, timetableId: timetable.id } });
    }

    res.json({ success: true, entry });
  } catch (error: any) {
    console.error('saveTimetableSlot error:', error);
    res.status(500).json({ error: 'Failed to save timetable slot.' });
  }
}

export async function deleteTimetableEntry(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    await prisma.timetableEntry.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Timetable entry removed.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
}

export async function aiScanTimetable(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Please upload an image or PDF of your timetable.' });
      return;
    }

    // Tell Gemini the real type from the (already validated) extension, not the browser-supplied mimetype
    const ext = file.originalname.split('.').pop()!.toLowerCase();
    const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const result = await parseTimetableImageWithGemini(file.buffer, mimeType);
    res.json({
      success: true,
      metadata: result.metadata,
      subjects: result.subjects,
      schedule: result.schedule,
    });
  } catch (error: any) {
    console.error('aiScanTimetable error:', error);
    res.status(502).json({ error: 'Could not scan the timetable image right now. Please try again or upload a CSV.' });
  }
}

export async function aiConfirmTimetable(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId, semesterId, branchId, subjects, schedule } = req.body;

    if (!sectionId || !semesterId || !branchId) {
      res.status(400).json({ error: 'sectionId, semesterId, and branchId are required.' });
      return;
    }

    if (!Array.isArray(schedule)) {
      res.status(400).json({ error: 'Schedule array is required.' });
      return;
    }

    const section = await prisma.section.findUnique({ where: { id: String(sectionId) } });
    if (!section || section.semesterId !== String(semesterId) || section.branchId !== String(branchId)) {
      res.status(400).json({ error: 'Section does not belong to the selected semester and branch.' });
      return;
    }

    const thresholdSetting = await prisma.systemSetting.findUnique({ where: { key: 'MINIMUM_ATTENDANCE_THRESHOLD' } });
    const defaultThreshold = parseThreshold(thresholdSetting?.value) ?? 85.0;

    // 1. Upsert subjects for this semester and branch
    const subjectCodeMap = new Map<string, string>(); // code or abbreviation -> subjectId
    if (Array.isArray(subjects)) {
      for (const sub of subjects) {
        if (!sub.code || !sub.name) continue;
        const cleanCode = String(sub.code).trim().toUpperCase();
        const cleanName = String(sub.name).trim();
        const dbSubject = await prisma.subject.upsert({
          where: { code_semesterId_branchId: { code: cleanCode, semesterId: String(semesterId), branchId: String(branchId) } },
          create: {
            code: cleanCode,
            name: cleanName,
            credits: Number(sub.credits) || 4,
            semesterId: String(semesterId),
            branchId: String(branchId),
            minimumThreshold: parseThreshold(sub.minimumThreshold) ?? defaultThreshold,
          },
          update: { name: cleanName, credits: Number(sub.credits) || 4 },
        });
        subjectCodeMap.set(cleanCode, dbSubject.id);
        if (sub.abbreviation) {
          const abbr = String(sub.abbreviation).trim().toUpperCase();
          if (abbr && !subjectCodeMap.has(abbr)) subjectCodeMap.set(abbr, dbSubject.id);
        }
      }
    }
    const allDbSubjects = await prisma.subject.findMany({ where: { semesterId: String(semesterId), branchId: String(branchId) } });
    allDbSubjects.forEach((s) => subjectCodeMap.set(s.code.toUpperCase(), s.id));

    // 2. Resolve or create active Academic Year
    let academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!academicYear) academicYear = await prisma.academicYear.findFirst({ orderBy: { startDate: 'desc' } });
    if (!academicYear) {
      res.status(400).json({ error: 'No academic year found. Please create one in settings first.' });
      return;
    }

    // 3. Normalise every slot before touching the database
    const unresolved = new Set<string>();
    let skipped = 0;
    const entriesToCreate: EntryData[] = [];
    for (const slot of schedule as any[]) {
      const type = String(slot.type || (slot.batch && slot.batch !== 'ALL' ? 'LAB' : 'LECTURE')).toUpperCase();
      const code = slot.subjectCode ? String(slot.subjectCode).trim().toUpperCase() : '';
      const subjectId = code ? subjectCodeMap.get(code) || null : null;
      if (code && !subjectId && !BREAK_TYPES.includes(type)) unresolved.add(code);
      const clean = cleanSlot({ ...slot, type }, subjectId);
      if (clean) entriesToCreate.push(clean);
      else skipped++;
    }

    // 4. Find or create the timetable, then swap slots in one transaction
    let timetable = await prisma.timetable.findFirst({
      where: { sectionId: String(sectionId), semesterId: String(semesterId), branchId: String(branchId), isActive: true },
    });
    if (!timetable) {
      timetable = await prisma.timetable.create({
        data: {
          academicYearId: academicYear.id,
          sectionId: String(sectionId),
          semesterId: String(semesterId),
          branchId: String(branchId),
          isActive: true,
        },
      });
    }
    await replaceTimetableEntries(timetable.id, entriesToCreate);

    await logAuditAction({
      actorEmail: req.user?.email || 'admin',
      actorRole: req.user?.role || 'ADMIN',
      action: 'TIMETABLE_AI_IMPORTED',
      targetEntity: 'Timetable',
      targetId: timetable.id,
      details: {
        sectionId,
        semesterId,
        branchId,
        subjectsCount: subjects?.length || 0,
        entriesCount: entriesToCreate.length,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Imported ${entriesToCreate.length} timetable entries${skipped ? `, skipped ${skipped} with an unreadable day or time` : ''}.`,
      timetableId: timetable.id,
      count: entriesToCreate.length,
      skipped,
      unresolvedCodes: [...unresolved],
    });
  } catch (error: any) {
    console.error('aiConfirmTimetable error:', error);
    res.status(500).json({ error: 'Failed to save scanned timetable.' });
  }
}

export async function clearSectionTimetable(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId, semesterId, branchId } = (req.method === 'POST' ? req.body : req.query) as any;

    if (!sectionId || !semesterId || !branchId) {
      res.status(400).json({ error: 'sectionId, semesterId and branchId are all required to clear a timetable.' });
      return;
    }
    const where = { sectionId: String(sectionId), semesterId: String(semesterId), branchId: String(branchId) };

    const timetables = await prisma.timetable.findMany({ where });
    const timetableIds = timetables.map((t) => t.id);

    if (timetableIds.length > 0) {
      await prisma.timetableEntry.deleteMany({
        where: { timetableId: { in: timetableIds } },
      });
      await prisma.timetable.deleteMany({
        where: { id: { in: timetableIds } },
      });
    }

    await logAuditAction({
      actorEmail: req.user?.email || 'admin',
      actorRole: req.user?.role || 'ADMIN',
      action: 'TIMETABLE_CLEARED',
      targetEntity: 'Timetable',
      details: { sectionId, semesterId, branchId, deletedTimetableCount: timetableIds.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Timetable cleared successfully.' });
  } catch (error: any) {
    console.error('clearSectionTimetable error:', error);
    res.status(500).json({ error: 'Failed to clear timetable.' });
  }
}
