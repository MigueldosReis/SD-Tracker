import { describe, expect, test } from 'bun:test';
import { automate } from './automations';
import type { Order } from './tracker-fields';

const today = '2026-11-26';
const order = (o: Partial<Order>): Order =>
  ({
    id: 'x',
    board: 'orders',
    groupName: 'Open Orders',
    status: 'Order to be Placed',
    ...o
  }) as Order;

describe('automate', () => {
  test('Complete and Cancelled file the order in their group', () => {
    expect(automate(order({}), { status: 'Complete' }, today).extra).toEqual({
      groupName: 'Completed'
    });
    expect(automate(order({}), { status: 'Cancelled' }, today).extra).toEqual({
      groupName: 'Cancelled'
    });
  });
  test('an explicit group in the same edit wins', () => {
    expect(automate(order({}), { status: 'Complete', groupName: 'HOLB' }, today).extra).toEqual({});
  });
  test('reopening moves the order back to its board, or the source board for a view', () => {
    expect(
      automate(
        order({ groupName: 'Completed', status: 'Complete' }),
        { status: 'In Progress' },
        today
      ).extra.groupName
    ).toBe('HOLB');
    const mrp = order({ board: 'mrp-projects', groupName: 'Cancelled', status: 'Cancelled' });
    expect(automate(mrp, { status: 'Awaiting Landlord Approval' }, today).extra.groupName).toBe(
      'Mr Price Project Orders'
    );
  });
  test('booking a date moves the order on', () => {
    const r = automate(
      order({ status: 'Awaiting Install Dates' }),
      { installDate: '2026-12-08' },
      today
    );
    expect(r.extra.status).toBe('Install Scheduled');
    expect(r.notes[0]).toContain('install date was filled in');
    expect(
      automate(order({ status: 'Awaiting Site Survey' }), { siteSurvey: '2026-12-01' }, today).extra
        .status
    ).toBe('Site Survey Scheduled');
    expect(
      automate(order({ status: 'Cutover to be Scheduled' }), { cutoverDate: '2026-12-01' }, today)
        .extra.status
    ).toBe('Cutover Scheduled');
  });
  test('booking a date does nothing at other steps, when cleared, or when the status is set too', () => {
    expect(
      automate(
        order({ status: 'Order Placed with Supplier' }),
        { installDate: '2026-12-08' },
        today
      ).extra
    ).toEqual({});
    expect(
      automate(order({ status: 'Awaiting Install Dates' }), { installDate: null }, today).extra
    ).toEqual({});
    expect(
      automate(
        order({ status: 'Awaiting Install Dates' }),
        { installDate: '2026-12-08', status: 'On Hold' },
        today
      ).extra.status
    ).toBeUndefined();
  });
  test('a status change on a follow-up board counts as a follow-up', () => {
    const o = order({ board: 'mrp-new-stores', groupName: 'Mr Price New Stores' });
    expect(automate(o, { status: 'Order Placed with Supplier' }, today).extra).toEqual({
      lastFollowUp: today
    });
    expect(automate(order({}), { status: 'Order Placed with Supplier' }, today).extra).toEqual({});
  });
});
