import { describe, expect, test } from 'bun:test';
import { stepState } from './journey';
import { workingDaysBetween } from './working-days';

describe('workingDaysBetween', () => {
  test('counts working days after the start date', () => {
    expect(workingDaysBetween('2026-11-23', '2026-11-26')).toBe(3); // Mon -> Thu
    expect(workingDaysBetween('2026-11-27', '2026-11-30')).toBe(1); // Fri -> Mon
    expect(workingDaysBetween('2026-12-15', '2026-12-17')).toBe(1); // skips Day of Reconciliation
    expect(workingDaysBetween('2026-11-26', '2026-11-26')).toBe(0);
  });
});

describe('stepState', () => {
  const today = '2026-11-26';
  test('timed step on time', () => {
    const s = stepState({ status: 'Order Placed with Supplier', statusSince: '2026-11-20' }, today);
    expect(s).toMatchObject({ step: 3, late: false, daysInStep: 4, summary: 'Day 4 of 7-10' });
  });
  test('timed step late', () => {
    const s = stepState(
      { status: 'Awaiting Install Dates', statusSince: '2026-11-12T09:00:00.000+02:00' },
      today
    );
    expect(s.late).toBe(true);
    expect(s.daysInStep).toBe(10);
    expect(s.daysLate).toBe(5);
  });
  test('dated step: late once the date passes', () => {
    expect(
      stepState({ status: 'Install Scheduled', installDate: '2026-11-20' }, today)
    ).toMatchObject({ late: true, due: '2026-11-20' });
    expect(
      stepState({ status: 'Install Scheduled', installDate: '2026-12-02' }, today)
    ).toMatchObject({ late: false });
    expect(stepState({ status: 'Install Scheduled' }, today).summary).toBe('No install date yet');
  });
  test('waiting steps and other statuses are never late', () => {
    expect(
      stepState({ status: 'Awaiting Landlord Approval', statusSince: '2026-01-01' }, today).late
    ).toBe(false);
    expect(stepState({ status: 'On Hold', statusSince: '2026-01-01' }, today)).toMatchObject({
      step: null,
      late: false
    });
    expect(stepState({ status: 'Complete' }, today)).toMatchObject({ step: 16, late: false });
  });
  test('unknown start of step: not flagged on time alone', () => {
    expect(stepState({ status: 'Order to be Placed' }, today)).toMatchObject({
      late: false,
      summary: 'Start of this step not recorded'
    });
  });
});
