import { describe, it, expect } from 'vitest';
import { isWithinQuietHours, isAllowedPushEndpoint } from '../services/notificationService.js';

// A moment at the given wall-clock time in India (UTC+05:30), whatever timezone the server runs in
const ist = (h: number, m: number) => new Date(Date.UTC(2024, 8, 1, h, m) - 330 * 60 * 1000);

describe('Notification Service - Quiet Hours & Deduplication Rules', () => {
  it('correctly identifies time inside overnight quiet hours (23:00 to 07:00)', () => {
    // 23:30 should be in quiet hours
    const d1 = ist(23, 30);
    expect(isWithinQuietHours('23:00', '07:00', d1)).toBe(true);

    // 03:15 should be in quiet hours
    const d2 = ist(3, 15);
    expect(isWithinQuietHours('23:00', '07:00', d2)).toBe(true);

    // 06:59 should be in quiet hours
    const d3 = ist(6, 59);
    expect(isWithinQuietHours('23:00', '07:00', d3)).toBe(true);

    // 07:01 should NOT be in quiet hours
    const d4 = ist(7, 1);
    expect(isWithinQuietHours('23:00', '07:00', d4)).toBe(false);

    // 14:00 should NOT be in quiet hours
    const d5 = ist(14, 0);
    expect(isWithinQuietHours('23:00', '07:00', d5)).toBe(false);
  });

  it('correctly identifies daytime quiet hours (e.g. 13:00 to 15:00)', () => {
    const d1 = ist(14, 30);
    expect(isWithinQuietHours('13:00', '15:00', d1)).toBe(true);

    const d2 = ist(16, 0);
    expect(isWithinQuietHours('13:00', '15:00', d2)).toBe(false);
  });

  it('uses India time even when the server runs in UTC', () => {
    // 23:30 IST is 18:00 UTC: inside 23:00-07:00 quiet hours
    expect(isWithinQuietHours('23:00', '07:00', new Date(Date.UTC(2024, 8, 1, 18, 0)))).toBe(true);
    // 10:00 IST is 04:30 UTC: a UTC-based check would wrongly call this quiet
    expect(isWithinQuietHours('23:00', '07:00', new Date(Date.UTC(2024, 8, 1, 4, 30)))).toBe(false);
  });

  it('ignores malformed quiet hour strings instead of muting everything', () => {
    expect(isWithinQuietHours('abc', '07:00', ist(3, 0))).toBe(false);
  });
});

describe('Push endpoint allowlist', () => {
  it('accepts real push services and rejects everything else', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://169.254.169.254/', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'nope']) {
      expect(isAllowedPushEndpoint(bad)).toBe(false);
    }
  });
});
