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
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

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
Analyze this official engineering college timetable document.

CRITICAL PARSING RULES:
1. LEGEND / SUBJECT TABLE:
   - Carefully inspect the bottom/side subject list or legend.
   - For every course, extract:
     * code: Official subject code (e.g. "BCS501", "BCS502", "BCS503", "BAIL504", "BCS515C", "BCI586", "BRMK557", "BCS508")
     * name: Full course name
     * abbreviation: The shorthand tag used inside grid cells (e.g. "SE", "CN", "TOC", "DVL", "UNIX", "RM", "EVS")
     * type: "LECTURE" | "LAB" | "TUTORIAL" | "OTHER"
     * credits: Number (default 4 for theory, 2 for labs if not stated)

2. SCHEDULE GRID:
   - Days: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6.
   - Times: Normalize all times to 24-hour "HH:MM" format (e.g. 09:00, 09:55, 10:50, 11:10, 12:05, 13:00, 14:00, 14:55, 15:05, 16:00, 16:55).
   - Resolve Abbreviations: Every timetable cell containing a course abbreviation MUST be resolved to its official subjectCode from the legend.
   - Split Lab Batches:
     * When a period shows split batches like "DVLab(A1)(SSR)/CN lab(A2)(AM)":
       Emit TWO distinct entry objects:
       1) batch="A1", subjectCode="BAIL504", room="DV-Lab-A-307", faculty="SSR", type="LAB"
       2) batch="A2", subjectCode="BCS502", room="CN labA--323", faculty="AM", type="LAB"
   - For regular whole-class lectures, set batch="ALL".
   - Classroom: Use the default classroom from the header (e.g. "A-405") unless the cell or header specifies a specialized lab room.
   - Ignore or label pure breaks as title="Break" or title="Lunch Break" with type="INTERVAL".

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
    },
  };

  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
      const schedule: ExtractedScheduleEntry[] = rawEntries.map((e: any) => {
        let dayNum = Number(e.dayOfWeek);
        if (isNaN(dayNum) && e.day) {
          const daysMap: Record<string, number> = {
            mon: 1, monday: 1,
            tue: 2, tuesday: 2,
            wed: 3, wednesday: 3,
            thu: 4, thursday: 4,
            fri: 5, friday: 5,
            sat: 6, saturday: 6,
            sun: 7, sunday: 7,
          };
          dayNum = daysMap[String(e.day).toLowerCase()] || 1;
        }

        return {
          dayOfWeek: dayNum || 1,
          startTime: String(e.startTime || '').trim(),
          endTime: String(e.endTime || '').trim(),
          subjectCode: String(e.subjectCode || '').trim().toUpperCase(),
          subjectName: e.subjectName ? String(e.subjectName).trim() : undefined,
          faculty: e.faculty ? String(e.faculty).trim() : undefined,
          room: e.room ? String(e.room).trim() : undefined,
          type: e.type || 'LECTURE',
          batch: e.batch ? String(e.batch).trim().toUpperCase() : 'ALL',
          title: e.title ? String(e.title).trim() : undefined,
        };
      });

      return {
        metadata: parsed.metadata || {},
        subjects,
        schedule,
      };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to parse timetable with Gemini models.');
}
