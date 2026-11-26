import { describe, expect, test } from 'bun:test';
import { attentionFor, attentionList, mentions } from './attention';
import type { Order } from './tracker-fields';

const today = '2026-11-26'; // Thursday
const order = (o: Partial<Order>): Order =>
  ({
    id: 'x',
    board: 'orders',
    groupName: 'Open Orders',
    status: 'Order to be Placed',
    ...o
  }) as Order;

describe('attentionFor', () => {
  test('handover sent more than 2 working days ago: ready to close, with a one-click fix', () => {
    const [item] = attentionFor(
      order({ status: 'Handover Sent', statusSince: '2026-11-20' }),
      today
    );
    expect(item.kind).toBe('close');
    expect(item.action).toEqual({ label: 'Mark Complete', patch: { status: 'Complete' } });
  });
  test('booked date passed', () => {
    const [item] = attentionFor(
      order({ status: 'Install Scheduled', installDate: '2026-11-24' }),
      today
    );
    expect(item).toMatchObject({ kind: 'date-passed', date: '2026-11-24' });
  });
  test('late for a timed step', () => {
    expect(
      attentionFor(order({ status: 'Awaiting Install Dates', statusSince: '2026-11-10' }), today)[0]
        .kind
    ).toBe('late');
  });
  test('dates in the next 5 working days', () => {
    const items = attentionFor(
      order({ status: 'Cutover Scheduled', cutoverDate: '2026-12-02' }),
      today
    );
    expect(items).toEqual([expect.objectContaining({ kind: 'this-week', date: '2026-12-02' })]);
    expect(
      attentionFor(order({ status: 'Cutover Scheduled', cutoverDate: '2026-12-10' }), today)
    ).toEqual([]);
  });
  test('follow-ups on follow-up boards only', () => {
    const o = {
      status: 'Order Placed with Supplier',
      lastFollowUp: '2026-11-18',
      createdAt: '2026-11-01'
    };
    expect(
      attentionFor(order({ ...o, board: 'mrp-new-stores' }), today).map((i) => i.kind)
    ).toEqual(['follow-up']);
    expect(attentionFor(order({ ...o, board: 'orders' }), today)).toEqual([]);
  });
  test('closed orders need nothing', () => {
    expect(attentionFor(order({ status: 'Complete' }), today)).toEqual([]);
    expect(
      attentionFor(
        order({ status: 'Install Scheduled', installDate: '2026-11-01', groupName: 'Cancelled' }),
        today
      )
    ).toEqual([]);
  });
});

describe('attentionList', () => {
  const list = [
    order({
      id: 'a',
      owner: 'Jordan Petersen',
      status: 'Install Scheduled',
      installDate: '2026-11-24'
    }),
    order({ id: 'b', owner: 'Jordan Petersen', status: 'Handover Sent', statusSince: '2026-11-20' }),
    order({ id: 'c', status: 'Install Scheduled', installDate: '2026-11-25' })
  ];
  test('per owner, most urgent kind first', () => {
    expect(attentionList(list, today, 'Jordan Petersen').map((i) => i.orderId)).toEqual(['b', 'a']);
  });
  test('unassigned', () => {
    expect(attentionList(list, today, null).map((i) => i.orderId)).toEqual(['c']);
  });
});

describe('mentions', () => {
  test('first name or full name, any case', () => {
    expect(mentions('Thanks @jordan, can you check?')).toEqual(['Jordan Petersen']);
    expect(mentions('@Sam van Wyk please chase')).toEqual(['Sam van Wyk']);
    expect(mentions('@Alex and @Thandi')).toEqual(['Alex Mokoena', 'Thandi Dlamini']);
  });
  test('not an email address or another word', () => {
    expect(mentions('mail alex@example.com')).toEqual([]);
    expect(mentions('@Alexander')).toEqual([]);
  });
});
