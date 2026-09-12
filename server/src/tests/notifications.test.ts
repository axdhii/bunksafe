import { describe, it, expect } from 'vitest';
import { isWithinQuietHours } from '../services/notificationService.js';

describe('Notification Service - Quiet Hours & Deduplication Rules', () => {
  it('correctly identifies time inside overnight quiet hours (23:00 to 07:00)', () => {
    // 23:30 should be in quiet hours
    const d1 = new Date(2024, 8, 1, 23, 30);
    expect(isWithinQuietHours('23:00', '07:00', d1)).toBe(true);

    // 03:15 should be in quiet hours
    const d2 = new Date(2024, 8, 1, 3, 15);
    expect(isWithinQuietHours('23:00', '07:00', d2)).toBe(true);

    // 06:59 should be in quiet hours
    const d3 = new Date(2024, 8, 1, 6, 59);
    expect(isWithinQuietHours('23:00', '07:00', d3)).toBe(true);

    // 07:01 should NOT be in quiet hours
    const d4 = new Date(2024, 8, 1, 7, 1);
    expect(isWithinQuietHours('23:00', '07:00', d4)).toBe(false);

    // 14:00 should NOT be in quiet hours
    const d5 = new Date(2024, 8, 1, 14, 0);
    expect(isWithinQuietHours('23:00', '07:00', d5)).toBe(false);
  });

  it('correctly identifies daytime quiet hours (e.g. 13:00 to 15:00)', () => {
    const d1 = new Date(2024, 8, 1, 14, 30);
    expect(isWithinQuietHours('13:00', '15:00', d1)).toBe(true);

    const d2 = new Date(2024, 8, 1, 16, 0);
    expect(isWithinQuietHours('13:00', '15:00', d2)).toBe(false);
  });
});
