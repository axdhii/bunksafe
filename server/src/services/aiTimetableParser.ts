import { normalizeTime } from './timetableParser.js';

export interface ExtractedSubject {
  code: string;
  name: string;
  abbreviation?: string;
  credits?: number;
  type?: string;
  minimumThreshold?: number;
}

export interface ExtractedScheduleEntry {
  dayOfWeek: number; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  startTime: string; // "HH:MM" 24-hr
  endTime: string;   // "HH:MM" 24-hr
  subjectCode: string;
  subjectName?: string;
  faculty?: string;
  room?: string;
  type?: string;     // "LECTURE" | "LAB" | "TUTORIAL" | "INTERVAL" | "LUNCH" | "BREAK" | "OTHER"
  batch?: string;    // "ALL" | "A1" | "A2" | "B1" | "B2"
  title?: string;
}

export interface ExtractedTimetableResult {
  metadata: {
    semesterNumber?: number;
    sectionName?: string;
    branchCode?: string;
    classroom?: string;
    classAdvisor?: string;
  };
  subjects: ExtractedSubject[];
  schedule: ExtractedScheduleEntry[];
}

const FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

export function mergeConsecutiveScheduleEntries(entries: ExtractedScheduleEntry[]): ExtractedScheduleEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    if ((a.batch || '') !== (b.batch || '')) return (a.batch || '').localeCompare(b.batch || '');
    return (a.subjectCode || '').localeCompare(b.subjectCode || '');
  });

  const merged: ExtractedScheduleEntry[] = [];

  for (const entry of sorted) {
    const candidate = merged.find(
      (m) =>
        m.dayOfWeek === entry.dayOfWeek &&
        ((m.subjectCode && m.subjectCode === entry.subjectCode) ||
          (!m.subjectCode && !entry.subjectCode && (m.title || m.subjectName) === (entry.title || entry.subjectName))) &&
        (m.batch || 'ALL') === (entry.batch || 'ALL') &&
        m.endTime === entry.startTime
    );

    if (candidate) {
      candidate.endTime = entry.endTime;
      if (!candidate.faculty && entry.faculty) candidate.faculty = entry.faculty;
      if (!candidate.room && entry.room) candidate.room = entry.room;
      if (entry.type === 'LAB' || candidate.type === 'LAB') candidate.type = 'LAB';
    } else {
      merged.push({ ...entry });
    }
  }

  return merged;
}

/** A model stopped early if it returned fewer than 15 slots or covered fewer than 4 days. */
export function isIncompleteSchedule(schedule: ExtractedScheduleEntry[]): boolean {
  return schedule.length < 15 || new Set(schedule.map((s) => s.dayOfWeek)).size < 4;
}

export async function parseTimetableImageWithGemini(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedTimetableResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment variables.');
  }

  const base64Data = imageBuffer.toString('base64');

  const prompt = `You are a high-precision college timetable parsing engine.
Analyze this official engineering college timetable document and extract the complete weekly schedule.

CRITICAL PARSING RULES:
1. MERGED / MULTI-PERIOD CELLS (CRITICAL):
   - In college timetables, practical labs, mini-projects, workshops, sports, and certifications span across 2 or more consecutive periods in the grid (e.g. columns 11.10AM TO 12.05PM and 12.05PM TO 1.00PM are merged into a single 2-hour block).
   - NEVER emit duplicate entries for each individual period column of a merged block!
   - Combine the merged span into ONE single entry from the start time of the first period to the end time of the last period.
   - Example 1: Monday 11:10AM to 1:00PM shows "DVLab(A1)(SSR)/CN lab(A2)(AM)":
     Emit EXACTLY TWO entries for the entire 2-hour 11:10-13:00 block (ONE per batch):
     1) startTime: "11:10", endTime: "13:00", subjectCode: "BAIL504", subjectName: "Data Visualization Lab", batch: "A1", room: "DV-Lab-A-307", faculty: "SSR", type: "LAB"
     2) startTime: "11:10", endTime: "13:00", subjectCode: "BCS502", subjectName: "Computer Networks Lab", batch: "A2", room: "CN labA--323", faculty: "AM", type: "LAB"
   - Example 2: Thursday 9:00AM to 10:50AM shows "DVLab(A2)(SSR)/CN lab(A1)(AM)":
     Emit EXACTLY TWO entries for the entire 09:00-10:50 block (ONE per batch):
     1) startTime: "09:00", endTime: "10:50", subjectCode: "BAIL504", subjectName: "Data Visualization Lab", batch: "A2", room: "DV-Lab-A-307", faculty: "SSR", type: "LAB"
     2) startTime: "09:00", endTime: "10:50", subjectCode: "BCS502", subjectName: "Computer Networks Lab", batch: "A1", room: "CN labA--323", faculty: "AM", type: "LAB"
   - Example 3: Tuesday and Wednesday 11:10AM to 1:00PM shows "Miniproject( L-423)":
     Emit ONE entry for 11:10-13:00:
     startTime: "11:10", endTime: "13:00", subjectCode: "BCI586", subjectName: "Mini Project", batch: "ALL", room: "L-423", faculty: "Mrs. Nisha A Rai", type: "LAB"
   - Example 4: Monday 3:05PM to 4:55PM shows "Certification":
     Emit ONE entry: startTime: "15:05", endTime: "16:55", subjectCode: "CERT", subjectName: "Certification", batch: "ALL", type: "OTHER"
   - Example 5: Friday 3:05PM to 4:55PM shows "NSS/Yoga/Sports":
     Emit ONE entry: startTime: "15:05", endTime: "16:55", subjectCode: "NSS", subjectName: "NSS/Yoga/Sports", batch: "ALL", type: "OTHER"

2. COMPLETE ALL DAYS AND AFTERNOON SESSIONS (DO NOT STOP EARLY):
   - You MUST extract the schedule for EVERY day row shown in the table from Monday to Friday, and Saturday if listed.
   - Be sure to extract afternoon sessions from 2:00PM to 4:55PM for every day (e.g. Unix, Certification, EVS, Library, Counselling, NSS/Yoga/Sports).
   - DO NOT STOP after morning sessions!

3. LEGEND / SUBJECT TABLE:
   - Carefully inspect the bottom/side subject list or legend.
   - For every course, extract:
     * code: Official subject code (e.g. "BCS501", "BCS502", "BCS503", "BAIL504", "BCS515C", "BCI586", "BRMK557", "BCS508")
     * name: Full course name
     * abbreviation: The shorthand tag used inside grid cells (e.g. "SE", "CN", "TOC", "DVL", "UNIX", "RM", "EVS")
     * type: "LECTURE" | "LAB" | "TUTORIAL" | "OTHER"
     * credits: Number (default 4 for theory, 2 for labs if not stated)

4. SCHEDULE GRID:
   - Days: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6.
   - Times: Normalize all times to 24-hour "HH:MM" format (e.g. 09:00, 09:55, 10:50, 11:10, 12:05, 13:00, 14:00, 14:55, 15:05, 16:00, 16:55).
   - Resolve Abbreviations: Every timetable cell containing a course abbreviation MUST be resolved to its official subjectCode from the legend.
   - For regular whole-class lectures, set batch="ALL".
   - Classroom: Use the default classroom from the header (e.g. "A-405") unless the cell or header specifies a specialized lab room.
   - Exclude lunch breaks and tea breaks, or mark them with type="INTERVAL".

OUTPUT FORMAT:
Return strictly valid JSON matching this structure:
{
  "metadata": {
    "semesterNumber": 5,
    "sectionName": "A",
    "branchCode": "AIML",
    "classroom": "A-405",
    "classAdvisor": "Mrs. Nisha A Rai"
  },
  "subjects": [
    {
      "code": "BCS501",
      "name": "Software Engineering & Project Management",
      "abbreviation": "SE",
      "type": "LECTURE",
      "credits": 4
    }
  ],
  "schedule": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "09:55",
      "subjectCode": "BCS503",
      "subjectName": "Theory of Computation",
      "faculty": "Dr. Vineetha Pais",
      "batch": "ALL",
      "room": "A-405",
      "type": "LECTURE"
    }
  ]
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45000),
        }
      );

      const data = (await response.json()) as any;

      if (data.error) {
        lastError = new Error(`Gemini (${model}): ${data.error.message}`);
        // If 503 or quota spike, try next fallback model
        continue;
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error(`Empty response returned from Gemini (${model}).`);
      }

      const parsed = JSON.parse(rawText);

      // Normalize return data structure
      const subjects: ExtractedSubject[] = (parsed.subjects || parsed.courses || []).map((s: any) => ({
        code: String(s.code || '').trim().toUpperCase(),
        name: String(s.name || '').trim(),
        abbreviation: s.abbreviation ? String(s.abbreviation).trim().toUpperCase() : undefined,
        credits: Number(s.credits) || 4,
        type: s.type || (s.name?.toLowerCase().includes('lab') ? 'LAB' : 'LECTURE'),
        minimumThreshold: 85.0,
      }));

      const rawEntries = parsed.schedule || parsed.entries || [];
      const mapped: (ExtractedScheduleEntry | null)[] = rawEntries.map((e: any) => {
        let dayNum = Number(e.dayOfWeek);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) {
          const rawDay = String(e.dayOfWeek || e.day || '').toLowerCase();
          const daysMap: Record<string, number> = {
            mon: 1, monday: 1,
            tue: 2, tuesday: 2,
            wed: 3, wednesday: 3,
            thu: 4, thursday: 4,
            fri: 5, friday: 5,
            sat: 6, saturday: 6,
            sun: 7, sunday: 7,
          };
          for (const [k, v] of Object.entries(daysMap)) {
            if (rawDay.includes(k)) {
              dayNum = v;
              break;
            }
          }
        }

        let entryType = String(e.type || 'LECTURE').trim().toUpperCase();
        if (entryType === 'THEORY') entryType = 'LECTURE';

        // Drop slots with an unknown day or unreadable times instead of guessing (e.g. defaulting to Monday)
        const startTime = normalizeTime(e.startTime);
        const endTime = normalizeTime(e.endTime);
        if (!(dayNum >= 1 && dayNum <= 7) || !startTime || !endTime || startTime >= endTime) return null;

        return {
          dayOfWeek: dayNum,
          startTime,
          endTime,
          subjectCode: String(e.subjectCode || '').trim().toUpperCase(),
          subjectName: e.subjectName ? String(e.subjectName).trim() : undefined,
          faculty: e.faculty ? String(e.faculty).trim() : undefined,
          room: e.room ? String(e.room).trim() : undefined,
          type: entryType,
          batch: e.batch ? String(e.batch).trim().toUpperCase() : 'ALL',
          title: e.title ? String(e.title).trim() : undefined,
        };
      });

      const schedule = mapped.filter((e): e is ExtractedScheduleEntry => e !== null);

      // Deterministically merge any consecutive slots for the same subject/batch across multi-period blocks
      const cleanedSchedule = mergeConsecutiveScheduleEntries(schedule);

      // Completeness Gate: If a model extracted fewer than 15 entries or fewer than 4 distinct days,
      // it prematurely stopped. Reject and try next fallback model if available.
      if (isIncompleteSchedule(cleanedSchedule) && model !== FALLBACK_MODELS[FALLBACK_MODELS.length - 1]) {
        console.warn(`[AI Scanner] Model ${model} returned partial schedule (${cleanedSchedule.length} entries). Trying fallback...`);
        lastError = new Error(`Model ${model} returned incomplete schedule (${cleanedSchedule.length} entries).`);
        continue;
      }

      return {
        metadata: parsed.metadata || {},
        subjects,
        schedule: cleanedSchedule,
      };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to parse timetable with Gemini models.');
}
