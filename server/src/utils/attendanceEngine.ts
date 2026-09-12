export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL';

export interface SubjectAttendanceCalculation {
  conducted: number;
  attended: number;
  absent: number;
  percentage: number;
  risk: RiskLevel;
  safeSkips: number;
  recoveryRequired: number;
  nextIfAttended: number;
  nextIfMissed: number;
}

/**
 * Computes deterministic attendance statistics.
 *
 * Rules:
 * - Cancelled, Rescheduled, and Holiday classes are NOT counted as conducted.
 * - Percentage = (attended / conducted) * 100
 * - Edge case: conducted == 0 -> percentage is 100%, 0 skips, 0 recovery, SAFE.
 * - Safe skips: Maximum classes a student can miss while keeping percentage >= threshold.
 *   Formula: Math.floor(attended / (threshold / 100) - conducted)
 * - Recovery required: Minimum classes a student must attend consecutively to reach >= threshold.
 *   Formula: Math.ceil(((threshold / 100) * conducted - attended) / (1 - (threshold / 100)))
 * - Risk stratification:
 *   - CRITICAL (Red): percentage < threshold
 *   - WARNING (Yellow): threshold <= percentage < threshold + 3% OR safeSkips <= 1
 *   - SAFE (Green): percentage >= threshold + 3% AND safeSkips >= 2
 */
export function calculateAttendance(
  attended: number,
  conducted: number,
  threshold: number = 85.0
): SubjectAttendanceCalculation {
  if (conducted <= 0) {
    return {
      conducted: 0,
      attended: 0,
      absent: 0,
      percentage: 100.0,
      risk: 'SAFE',
      safeSkips: 0,
      recoveryRequired: 0,
      nextIfAttended: 100.0,
      nextIfMissed: 0.0,
    };
  }

  const absent = Math.max(0, conducted - attended);
  const ratio = attended / conducted;
  const percentage = Math.round(ratio * 1000) / 10;
  const t = threshold / 100.0;

  // Safe Skips
  let safeSkips = 0;
  if (ratio >= t) {
    safeSkips = Math.max(0, Math.floor((attended / t) - conducted + 1e-9));
  }

  // Classes required to recover
  let recoveryRequired = 0;
  if (ratio < t) {
    recoveryRequired = Math.max(0, Math.ceil(((t * conducted - attended) / (1.0 - t)) - 1e-9));
  }

  // Next class projections
  const nextIfAttended = Math.round(((attended + 1) / (conducted + 1)) * 1000) / 10;
  const nextIfMissed = Math.round((attended / (conducted + 1)) * 1000) / 10;

  // Risk Classification
  let risk: RiskLevel = 'SAFE';
  if (percentage < threshold) {
    risk = 'CRITICAL';
  } else if (percentage < threshold + 3.0 || safeSkips <= 1) {
    risk = 'WARNING';
  } else {
    risk = 'SAFE';
  }

  return {
    conducted,
    attended,
    absent,
    percentage,
    risk,
    safeSkips,
    recoveryRequired,
    nextIfAttended,
    nextIfMissed,
  };
}

/**
 * Calculates future scenarios and projections.
 */
export function calculateProjectionScenario(
  attended: number,
  conducted: number,
  remainingClasses: number
) {
  const current = conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 100.0;

  const projectRate = (rate: number) => {
    if (remainingClasses <= 0) return current;
    const add = Math.floor(remainingClasses * rate);
    return Math.round(((attended + add) / (conducted + remainingClasses)) * 1000) / 10;
  };

  const projectDelta = (addAttended: number, addMissed: number) => {
    const newConducted = conducted + addAttended + addMissed;
    if (newConducted <= 0) return 100.0;
    return Math.round(((attended + addAttended) / newConducted) * 1000) / 10;
  };

  return {
    current,
    totalRemaining: remainingClasses,
    attendAllRemaining: projectRate(1.0),
    attend90Remaining: projectRate(0.9),
    attend85Remaining: projectRate(0.85),
    attend75Remaining: projectRate(0.75),
    missNext1: projectDelta(0, 1),
    missNext2: projectDelta(0, 2),
    attendNext1: projectDelta(1, 0),
    attendNext3: projectDelta(3, 0),
  };
}

/**
 * Computes consecutive attended streak and longest historical streak.
 * records should be chronologically ordered (earliest to latest or latest to earliest).
 */
export function calculateAttendanceStreak(
  records: { date: string; status: string }[]
): { currentStreak: number; longestStreak: number } {
  if (!records || records.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort ascending by date
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let running = 0;

  for (const record of sorted) {
    if (record.status === 'PRESENT') {
      running += 1;
      if (running > longestStreak) {
        longestStreak = running;
      }
    } else if (record.status === 'ABSENT') {
      running = 0;
    }
    // CANCELLED, RESCHEDULED, HOLIDAY do not break attendance streak
  }

  // Current streak is from the latest records backwards
  const reversed = [...sorted].reverse();
  for (const record of reversed) {
    if (record.status === 'PRESENT') {
      currentStreak += 1;
    } else if (record.status === 'ABSENT') {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
  };
}
