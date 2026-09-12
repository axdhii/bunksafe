import { RiskLevel } from '../types';

export interface CalculationResult {
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
 * Calculates deterministic attendance metrics based on attended, conducted, and minimum threshold.
 */
export function calculateAttendanceMetrics(
  attended: number,
  conducted: number,
  threshold: number = 85.0
): CalculationResult {
  const t = threshold / 100.0;
  
  // Edge case: No classes conducted yet
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
  const currentRatio = attended / conducted;
  const percentage = Math.round(currentRatio * 1000) / 10; // 1 decimal point precision

  // Safe Skips: Max classes that can be missed while ratio >= threshold
  let safeSkips = 0;
  if (currentRatio >= t) {
    safeSkips = Math.max(0, Math.floor((attended / t) - conducted + 1e-9));
  }

  // Recovery: Min consecutive classes required to reach ratio >= threshold
  let recoveryRequired = 0;
  if (currentRatio < t) {
    recoveryRequired = Math.max(0, Math.ceil(((t * conducted - attended) / (1.0 - t)) - 1e-9));
  }

  // What happens next class?
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
 * Calculates projected attendance given remaining scheduled classes and hypothetical attendance rate.
 */
export function calculateProjection(
  attended: number,
  conducted: number,
  remainingClasses: number,
  attendRate: number // 0.0 to 1.0 (e.g. 1.0 for 100%, 0.9 for 90%)
): number {
  if (remainingClasses <= 0) {
    return conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 100.0;
  }
  const additionalAttended = Math.floor(remainingClasses * attendRate);
  const totalAttended = attended + additionalAttended;
  const totalConducted = conducted + remainingClasses;
  return Math.round((totalAttended / totalConducted) * 1000) / 10;
}

/**
 * Simulates arbitrary delta (+ attended, + missed)
 */
export function simulateScenario(
  attended: number,
  conducted: number,
  addAttended: number,
  addMissed: number
): number {
  const newAttended = attended + addAttended;
  const newConducted = conducted + addAttended + addMissed;
  if (newConducted <= 0) return 100.0;
  return Math.round((newAttended / newConducted) * 1000) / 10;
}

export const calculateAttendance = calculateAttendanceMetrics;
