import { describe, it, expect } from 'vitest';
import {
  calculateAttendance,
  calculateProjectionScenario,
  calculateAttendanceStreak,
} from '../utils/attendanceEngine.js';

describe('Attendance Engine - Mathematical Correctness & Edge Cases', () => {
  it('should calculate standard percentage correctly (24/30 = 80.0%)', () => {
    const result = calculateAttendance(24, 30, 75.0);
    expect(result.percentage).toBe(80.0);
    expect(result.attended).toBe(24);
    expect(result.conducted).toBe(30);
    expect(result.absent).toBe(6);
    expect(result.recoveryRequired).toBe(0);
    expect(result.safeSkips).toBe(2); // 24 / 0.75 - 30 = 32 - 30 = 2
    expect(result.risk).toBe('SAFE');
  });

  it('handles edge case: 0 conducted classes gracefully', () => {
    const result = calculateAttendance(0, 0, 75.0);
    expect(result.percentage).toBe(100.0);
    expect(result.safeSkips).toBe(0);
    expect(result.recoveryRequired).toBe(0);
    expect(result.risk).toBe('SAFE');
    expect(result.nextIfAttended).toBe(100.0);
    expect(result.nextIfMissed).toBe(0.0);
  });

  it('handles 100% attendance (10/10 classes attended)', () => {
    const result = calculateAttendance(10, 10, 75.0);
    expect(result.percentage).toBe(100.0);
    expect(result.recoveryRequired).toBe(0);
    // 10 / 0.75 - 10 = 13.333 - 10 = 3 skips
    expect(result.safeSkips).toBe(3);
    expect(result.risk).toBe('SAFE');
  });

  it('handles 0% attendance (0/5 classes attended)', () => {
    const result = calculateAttendance(0, 5, 75.0);
    expect(result.percentage).toBe(0.0);
    expect(result.safeSkips).toBe(0);
    // Recovery required to reach 75%: ceil((0.75 * 5 - 0) / 0.25) = ceil(3.75 / 0.25) = 15 classes
    // Verification: (0 + 15) / (5 + 15) = 15 / 20 = 75.0%
    expect(result.recoveryRequired).toBe(15);
    expect(result.risk).toBe('CRITICAL');
  });

  it('handles boundary condition: exactly 75.0% attendance (15/20)', () => {
    const result = calculateAttendance(15, 20, 75.0);
    expect(result.percentage).toBe(75.0);
    expect(result.recoveryRequired).toBe(0);
    expect(result.safeSkips).toBe(0); // 15 / 0.75 - 20 = 20 - 20 = 0
    expect(result.risk).toBe('WARNING'); // SafeSkips <= 1 triggers close to limit WARNING
  });

  it('handles just below 75.0% attendance: 74.9% (e.g. 74/99 = 74.7%)', () => {
    const result = calculateAttendance(74, 99, 75.0);
    expect(result.percentage).toBeLessThan(75.0);
    expect(result.risk).toBe('CRITICAL');
    expect(result.recoveryRequired).toBeGreaterThan(0);
    // Check recovery:
    const rec = result.recoveryRequired;
    const recoveredRatio = (74 + rec) / (99 + rec);
    expect(recoveredRatio).toBeGreaterThanOrEqual(0.75);
  });

  it('verifies exact recovery formula for OS demo case (15 attended / 21 conducted = 71.4%)', () => {
    const result = calculateAttendance(15, 21, 75.0);
    expect(result.percentage).toBe(71.4);
    expect(result.risk).toBe('CRITICAL');
    // ceil((0.75 * 21 - 15) / 0.25) = ceil((15.75 - 15) / 0.25) = ceil(0.75 / 0.25) = 3
    expect(result.recoveryRequired).toBe(3);

    // Verify recovery: attending next 3 classes gives 18/24 = 75.0%
    const recoveredRatio = (15 + 3) / (21 + 3);
    expect(recoveredRatio).toBe(0.75);
  });

  it('calculates next class projections accurately', () => {
    const result = calculateAttendance(20, 25, 75.0); // 80.0%
    // If attend next class: 21 / 26 = 80.769% -> 80.8%
    expect(result.nextIfAttended).toBe(80.8);
    // If miss next class: 20 / 26 = 76.923% -> 76.9%
    expect(result.nextIfMissed).toBe(76.9);
  });

  it('computes future projection scenarios correctly', () => {
    const scenario = calculateProjectionScenario(15, 21, 10);
    // 10 remaining classes
    // attend all remaining (10): (15 + 10) / (21 + 10) = 25 / 31 = 80.6%
    expect(scenario.attendAllRemaining).toBe(80.6);
    // attend 90% (9): (15 + 9) / (21 + 10) = 24 / 31 = 77.4%
    expect(scenario.attend90Remaining).toBe(77.4);
    // attend 85% (8): (15 + 8) / (21 + 10) = 23 / 31 = 74.2%
    expect(scenario.attend85Remaining).toBe(74.2);
    // attend 75% (7): (15 + 7) / (21 + 10) = 22 / 31 = 71.0%
    expect(scenario.attend75Remaining).toBe(71.0);
    // miss next 2: 15 / 23 = 65.2%
    expect(scenario.missNext2).toBe(65.2);
  });

  it('computes attendance streaks properly, ignoring cancelled classes', () => {
    const records = [
      { date: '2024-09-01', status: 'PRESENT' },
      { date: '2024-09-02', status: 'PRESENT' },
      { date: '2024-09-03', status: 'CANCELLED' }, // Does not break streak
      { date: '2024-09-04', status: 'PRESENT' },
      { date: '2024-09-05', status: 'ABSENT' }, // Breaks streak
      { date: '2024-09-06', status: 'PRESENT' },
      { date: '2024-09-07', status: 'PRESENT' },
      { date: '2024-09-08', status: 'PRESENT' },
    ];

    const streaks = calculateAttendanceStreak(records);
    expect(streaks.currentStreak).toBe(3); // 06, 07, 08
    expect(streaks.longestStreak).toBe(3);
  });
});
