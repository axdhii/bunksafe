import { Request, Response } from 'express';
import { prisma } from '../prisma/client.js';
import { parseTimetableBuffer } from '../services/timetableParser.js';
import { parseTimetableImageWithGemini } from '../services/aiTimetableParser.js';
import { logAuditAction } from '../services/auditService.js';

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
    const isCsv = ext === 'csv' || file.mimetype.includes('csv');
    const isXlsx = ext === 'xlsx' || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel');

    if (!isCsv && !isXlsx) {
      res.status(400).json({ error: 'Unsupported file format. Please provide a .csv or .xlsx file.' });
      return;
    }

    const parseResult = parseTimetableBuffer(file.buffer, isCsv ? 'csv' : 'xlsx');
    res.json(parseResult);
  } catch (error: any) {
    console.error('previewTimetableUpload error:', error);
    res.status(500).json({ error: 'Failed to parse timetable file: ' + error.message });
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

    // Atomically replace all entries in this timetable
    await prisma.$transaction(async (tx) => {
      // Delete old entries
      await tx.timetableEntry.deleteMany({
        where: { timetableId: timetable.id },
      });

      // Insert new entries
      for (const e of entries) {
        const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(e.type?.toUpperCase());
        const subjectId = isBreak ? null : (e.subjectId || (e.subjectCode ? subjectMap.get(String(e.subjectCode).trim().toUpperCase()) : null));
        
        await tx.timetableEntry.create({
          data: {
            timetableId: timetable.id,
            dayOfWeek: Number(e.dayOfWeek),
            startTime: String(e.startTime),
            endTime: String(e.endTime),
            subjectId: subjectId || null,
            title: e.title || (isBreak ? (e.type === 'LUNCH' ? 'Lunch Break' : 'Tea / Short Break') : null),
            faculty: e.faculty || null,
            room: e.room || null,
            type: e.type || 'LECTURE',
            batch: e.batch || 'ALL',
          },
        });
      }
    });

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

    const isBreak = ['INTERVAL', 'LUNCH', 'BREAK'].includes(type?.toUpperCase());
    if (!isBreak && !subjectId) {
      res.status(400).json({ error: 'Subject is required for class slots.' });
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
      entry = await prisma.timetableEntry.update({
        where: { id },
        data: {
          dayOfWeek: Number(dayOfWeek),
          startTime: String(startTime),
          endTime: String(endTime),
          subjectId: isBreak ? null : subjectId,
          title: title || (isBreak ? (type === 'LUNCH' ? 'Lunch Break' : 'Interval Break') : null),
          faculty: faculty || null,
          room: room || null,
          type: type || 'LECTURE',
          batch: batch || 'ALL',
        },
      });
    } else {
      entry = await prisma.timetableEntry.create({
        data: {
          timetableId: timetable.id,
          dayOfWeek: Number(dayOfWeek),
          startTime: String(startTime),
          endTime: String(endTime),
          subjectId: isBreak ? null : subjectId,
          title: title || (isBreak ? (type === 'LUNCH' ? 'Lunch Break' : 'Interval Break') : null),
          faculty: faculty || null,
          room: room || null,
          type: type || 'LECTURE',
          batch: batch || 'ALL',
        },
      });
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

    const result = await parseTimetableImageWithGemini(file.buffer, file.mimetype);
    res.json({
      success: true,
      metadata: result.metadata,
      subjects: result.subjects,
      schedule: result.schedule,
    });
  } catch (error: any) {
    console.error('aiScanTimetable error:', error);
    res.status(500).json({ error: error.message || 'Failed to scan timetable image with Gemini.' });
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

    // 1. Upsert subjects for this semester and branch
    const subjectCodeMap = new Map<string, string>(); // code -> subjectId

    if (Array.isArray(subjects)) {
      for (const sub of subjects) {
        if (!sub.code || !sub.name) continue;
        const cleanCode = String(sub.code).trim().toUpperCase();
        const cleanName = String(sub.name).trim();

        const dbSubject = await prisma.subject.upsert({
          where: {
            code_semesterId_branchId: {
              code: cleanCode,
              semesterId: String(semesterId),
              branchId: String(branchId),
            },
          },
          create: {
            code: cleanCode,
            name: cleanName,
            credits: Number(sub.credits) || 4,
            semesterId: String(semesterId),
            branchId: String(branchId),
            minimumThreshold: sub.minimumThreshold || 85.0,
          },
          update: {
            name: cleanName,
            credits: Number(sub.credits) || 4,
          },
        });

        subjectCodeMap.set(cleanCode, dbSubject.id);
      }
    }

    // Also load any existing subjects for this semester & branch into the map
    const allDbSubjects = await prisma.subject.findMany({
      where: { semesterId: String(semesterId), branchId: String(branchId) },
    });
    allDbSubjects.forEach((s) => {
      subjectCodeMap.set(s.code, s.id);
    });

    // 2. Resolve or create active Academic Year
    let academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!academicYear) {
      academicYear = await prisma.academicYear.findFirst({ orderBy: { startDate: 'desc' } });
    }
    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: {
          name: '2025-2026',
          startDate: new Date('2025-08-01'),
          endDate: new Date('2026-06-30'),
          isCurrent: true,
        },
      });
    }

    // 3. Find or create Timetable header for this section
    let timetable = await prisma.timetable.findFirst({
      where: {
        sectionId: String(sectionId),
        semesterId: String(semesterId),
        branchId: String(branchId),
        isActive: true,
      },
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
    } else {
      // Clear existing slots for clean slate
      await prisma.timetableEntry.deleteMany({
        where: { timetableId: timetable.id },
      });
    }

    // 4. Create new timetable entries
    const entriesToCreate = schedule.map((slot: any) => {
      const cleanCode = slot.subjectCode ? String(slot.subjectCode).trim().toUpperCase() : null;
      const subjectId = cleanCode ? subjectCodeMap.get(cleanCode) || null : null;
      const isBreak = slot.type === 'INTERVAL' || slot.type === 'LUNCH' || slot.type === 'BREAK';

      return {
        timetableId: timetable!.id,
        dayOfWeek: Number(slot.dayOfWeek) || 1,
        startTime: String(slot.startTime).trim(),
        endTime: String(slot.endTime).trim(),
        subjectId: isBreak ? null : subjectId,
        title: slot.title || (isBreak ? (slot.type === 'LUNCH' ? 'Lunch Break' : 'Tea Break') : (subjectId ? null : slot.subjectName || null)),
        faculty: slot.faculty ? String(slot.faculty).trim() : null,
        room: slot.room ? String(slot.room).trim() : null,
        type: slot.type || (slot.batch && slot.batch !== 'ALL' ? 'LAB' : 'LECTURE'),
        batch: slot.batch ? String(slot.batch).trim().toUpperCase() : 'ALL',
      };
    });

    await prisma.timetableEntry.createMany({
      data: entriesToCreate,
    });

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
      message: `Successfully imported ${entriesToCreate.length} timetable entries and synced subjects.`,
      timetableId: timetable.id,
      count: entriesToCreate.length,
    });
  } catch (error: any) {
    console.error('aiConfirmTimetable error:', error);
    res.status(500).json({ error: error.message || 'Failed to save scanned timetable.' });
  }
}
