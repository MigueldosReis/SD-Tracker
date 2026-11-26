import { describe, expect, test } from 'bun:test';
import {
  addWorkingDays,
  followUpState,
  isWorkingDay,
  nextFollowUp,
  todayZA,
  zaHolidays
} from './working-days';

describe('zaHolidays', () => {
  test('includes Easter holidays', () => {
    const h = zaHolidays(2026);
    expect(h.has('2026-04-03')).toBe(true); // Good Friday
    expect(h.has('2026-04-06')).toBe(true); // Family Day
    expect(zaHolidays(2025).has('2025-04-18')).toBe(true);
    expect(zaHolidays(2025).has('2025-04-21')).toBe(true);
  });
  test('moves a Sunday holiday to Monday', () => {
    // Freedom Day 2025 was a Sunday, so Monday 28 April was a holiday.
    expect(zaHolidays(2025).has('2025-04-28')).toBe(true);
    // Day of Goodwill 2027 is a Sunday.
    expect(zaHolidays(2027).has('2027-12-27')).toBe(true);
  });
  test('includes declared one-off holidays', () => {
    expect(zaHolidays(2024).has('2024-05-29')).toBe(true);
  });
});

describe('addWorkingDays', () => {
  test('skips weekends', () => {
    expect(addWorkingDays('2026-11-26', 3)).toBe('2026-12-01'); // Thu -> Tue
    expect(addWorkingDays('2026-11-27', 3)).toBe('2026-12-02'); // Fri -> Wed
    expect(addWorkingDays('2026-11-28', 3)).toBe('2026-12-02'); // Sat -> Wed
  });
  test('skips public holidays', () => {
    // Mon 14 Dec 2026 + 3: 15, (16 is Day of Reconciliation), 17, 18
    expect(addWorkingDays('2026-12-14', 3)).toBe('2026-12-18');
    // Over Christmas 2026: 24 (Thu), 25 Fri hol, weekend, 28 Mon (Day of Goodwill 26 is Saturday, no Monday off), 29
    expect(addWorkingDays('2026-12-23', 3)).toBe('2026-12-29');
    // Easter 2026: Thu 2 Apr + 3 -> skip Good Friday 3, weekend, Family Day 6 -> 7, 8, 9
    expect(addWorkingDays('2026-04-02', 3)).toBe('2026-04-09');
  });
  test('accepts full timestamps', () => {
    expect(addWorkingDays('2026-11-26T08:00:00.000+02:00', 3)).toBe('2026-12-01');
  });
  test('n = 0 rolls forward to a working day', () => {
    expect(addWorkingDays('2026-11-28', 0)).toBe('2026-11-30');
    expect(addWorkingDays('2026-11-26', 0)).toBe('2026-11-26');
  });
});

describe('follow-ups', () => {
  test('counts from the last follow-up, else from creation', () => {
    expect(nextFollowUp('2026-11-26', '2026-01-01')).toBe('2026-12-01');
    expect(nextFollowUp(null, '2026-11-26T08:00:00.000+02:00')).toBe('2026-12-01');
    expect(nextFollowUp(null, null)).toBeNull();
  });
  test('state', () => {
    expect(followUpState('2026-11-25', '2026-11-26')).toBe('overdue');
    expect(followUpState('2026-11-26', '2026-11-26')).toBe('due');
    expect(followUpState('2026-11-27', '2026-11-26')).toBe('upcoming');
  });
  test('isWorkingDay', () => {
    expect(isWorkingDay('2026-12-16')).toBe(false);
    expect(isWorkingDay('2026-12-17')).toBe(true);
  });
  test('todayZA uses UTC+2', () => {
    expect(todayZA(Date.UTC(2026, 10, 26, 22, 30))).toBe('2026-11-27');
    expect(todayZA(Date.UTC(2026, 10, 26, 21, 30))).toBe('2026-11-26');
  });
});
