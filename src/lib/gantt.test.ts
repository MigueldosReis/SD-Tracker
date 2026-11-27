import { describe, expect, test } from 'bun:test';
import { ganttRow } from './gantt';
import { addWorkingDays } from './working-days';

const today = '2026-11-26';

describe('ganttRow', () => {
  test('forecast handover wins over the estimate', () => {
    const r = ganttRow(
      {
        status: 'Order Placed with Supplier',
        statusSince: '2026-11-20',
        createdAt: '2026-11-01T08:00:00.000+02:00',
        forecastHandover: '2027-02-15'
      },
      today
    );
    expect(r).toMatchObject({
      start: '2026-11-01',
      end: '2027-02-15',
      estimated: false
    });
    expect(r.uncertain).toBe(false);
    expect(r.milestones.at(-1)).toEqual({
      kind: 'Handover',
      date: '2027-02-15',
      done: false
    });
  });

  test('estimate adds the usual time of each remaining step after a booked install', () => {
    const r = ganttRow(
      {
        status: 'Install Scheduled',
        statusSince: '2026-11-20',
        createdAt: '2026-10-01',
        siteSurvey: '2026-10-15',
        installDate: '2026-12-03'
      },
      today
    );
    // Install in Progress 30, Supplier Handover 5, Cutover to be Scheduled 3, Handover Sent 2.
    let want = '2026-12-03';
    for (const n of [30, 5, 3, 2]) want = addWorkingDays(want, n);
    expect(r).toMatchObject({
      stepEnd: '2026-12-03',
      end: want,
      estimated: true,
      late: false
    });
    expect(r.uncertain).toBe(false);
    expect(r.milestones.map((m) => [m.kind, m.done])).toEqual([
      ['Survey', true],
      ['Install', false],
      ['Handover', false]
    ]);
  });

  test('late step runs to today and steps that wait on others make the estimate uncertain', () => {
    const r = ganttRow(
      {
        status: 'Awaiting Install Dates',
        statusSince: '2026-11-02',
        createdAt: '2026-09-01'
      },
      today
    );
    expect(r.late).toBe(true);
    expect(r.stepEnd).toBe(today);
    const w = ganttRow({ status: 'Order Placed with Supplier', createdAt: '2026-11-01' }, today);
    expect(w.uncertain).toBe(true); // Awaiting Site Survey depends on the supplier
  });

  test('statuses outside the journey get no estimate', () => {
    const r = ganttRow({ status: 'On Hold', createdAt: '2026-08-01' }, today);
    expect(r).toMatchObject({ offJourney: true, end: today, stepEnd: today });
  });
});
