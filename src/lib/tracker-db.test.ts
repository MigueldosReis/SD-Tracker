// Runs the real database layer against a throwaway copy of the fictional sample data,
// so every rule and automation is checked on each `bun test`.
import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { todayZA } from './working-days';

mock.module('server-only', () => ({}));
const dbPath = path.join(mkdtempSync(path.join(tmpdir(), 'sd-tracker-test-')), 'tracker.db');
process.env.TRACKER_DB_PATH = dbPath;

let t: typeof import('./tracker-db');

beforeAll(async () => {
  const run = Bun.spawnSync(['node', 'scripts/import-orders.mjs', 'data/seed.sample.json'], {
    env: { ...process.env, TRACKER_DB_PATH: dbPath },
    stderr: 'pipe'
  });
  if (run.exitCode !== 0) throw new Error(`Importer failed: ${run.stderr.toString()}`);
  t = await import('./tracker-db');
});

const newOrder = (
  board: Parameters<typeof t.createOrder>[0]['board'] = 'orders',
  extra: Partial<Parameters<typeof t.createOrder>[0]> = {}
) =>
  t.createOrder({
    board,
    customer: 'Test Customer',
    site: 'Test Site',
    groupName: board === 'mrp-projects' ? 'Mr Price Project Orders' : 'Open Orders',
    ...extra
  });

describe('status rules', () => {
  test('Install Scheduled needs an install date', () => {
    const o = newOrder();
    expect(() => t.updateOrder(o.id, { status: 'Install Scheduled' })).toThrow(
      'Install date is needed'
    );
    expect(
      t.updateOrder(o.id, { status: 'Install Scheduled', installDate: '2026-12-10' }).status
    ).toBe('Install Scheduled');
  });
  test('Handover Sent needs the equipment serial number', () => {
    const o = newOrder();
    expect(() => t.updateOrder(o.id, { status: 'Handover Sent' })).toThrow(
      'Equipment serial number'
    );
  });
  test('a status change is logged and starts the step clock', () => {
    const o = newOrder();
    const u = t.updateOrder(o.id, { status: 'Order to be Placed' });
    expect(t.getLog(o.id)[0].text).toContain('Status changed from');
    expect(String(u.statusSince).slice(0, 10)).toBe(todayZA());
  });
});

describe('Mr Price store codes', () => {
  test('a store code is required on MRP boards', () => {
    expect(() => newOrder('mrp-new-stores')).toThrow('store code');
  });
  test('the store code is added to the site name, on create and on rename', () => {
    const o = newOrder('mrp-new-stores', {
      site: 'Mall of Africa',
      storeCode: '12345',
      groupName: 'Mr Price New Stores'
    });
    expect(o.site).toBe('Mall of Africa 12345');
    expect(t.updateOrder(o.id, { site: 'Menlyn' }).site).toBe('Menlyn 12345');
  });
});

describe('Landlord Approval view', () => {
  test('shows MRP project orders while in landlord approval, and only those', () => {
    const o = newOrder('mrp-projects', { storeCode: '54321' });
    const inView = () => t.listOrders('landlord-approval').some((x) => x.id === o.id);
    expect(inView()).toBe(false);
    t.updateOrder(o.id, { status: 'Awaiting Landlord Approval' });
    expect(inView()).toBe(true);
    t.updateOrder(o.id, { status: 'Awaiting Install Dates' });
    expect(inView()).toBe(false);
  });
  test('orders cannot be created on or moved to the view', () => {
    expect(() => newOrder('landlord-approval')).toThrow('Add the order on MRP Project Orders');
    expect(() => t.updateOrder(newOrder().id, { board: 'landlord-approval' })).toThrow(
      'cannot be moved'
    );
  });
});

describe('follow-ups', () => {
  test('recording a follow-up sets today and logs the note', () => {
    const o = newOrder('feasibility', { groupName: 'Feasibility Requests' });
    const u = t.recordFollowUp(o.id, 'Called supplier');
    expect(u.lastFollowUp).toBe(todayZA());
    expect(t.getLog(o.id)[0].text).toBe('Followed up: Called supplier');
  });
});

describe('updates and bulk changes', () => {
  test('updates are stored and counted; empty ones are refused', () => {
    const o = newOrder();
    expect(() => t.addUpdate(o.id, '   ', null)).toThrow('Write something');
    t.addUpdate(o.id, 'First update', 'Alex Mokoena');
    expect(t.getUpdates(o.id)).toHaveLength(1);
    expect(t.getOrder(o.id)?.updateCount).toBe(1);
  });
  test('bulk changes apply the same rules per order and report what they skipped', () => {
    const a = newOrder();
    const b = newOrder();
    t.updateOrder(b.id, { installDate: '2026-12-10' });
    const res = t.bulkUpdate([a.id, b.id], { status: 'Install Scheduled' });
    expect(res.map((r) => r.ok)).toEqual([false, true]);
    expect(res[0].error).toContain('Install date is needed');
  });
});

describe('built-in automations', () => {
  test('Complete files the order in Completed, and reopening brings it back', () => {
    const o = newOrder();
    expect(t.updateOrder(o.id, { status: 'Complete' }).groupName).toBe('Completed');
    expect(t.getLog(o.id).some((l) => l.text.startsWith('Automation (File finished orders)'))).toBe(
      true
    );
    expect(t.updateOrder(o.id, { status: 'In Progress' }).groupName).toBe('HOLB');
  });
  test('booking the install date moves the order to Install Scheduled', () => {
    const o = newOrder();
    t.updateOrder(o.id, { status: 'Awaiting Install Dates' });
    const u = t.updateOrder(o.id, { installDate: '2026-12-08' });
    expect(u.status).toBe('Install Scheduled');
  });
  test('a status change on a follow-up board counts as a follow-up', () => {
    const o = newOrder('feasibility', { groupName: 'Feasibility Requests' });
    expect(t.updateOrder(o.id, { status: 'Order to be Placed' }).lastFollowUp).toBe(todayZA());
  });
  test('the person adding an order becomes its owner', () => {
    expect(newOrder('orders', { owner: 'Alex Mokoena' }).owner).toBe('Alex Mokoena');
  });
  test('automation runs are listed', () => {
    expect(t.automationRuns().length).toBeGreaterThan(0);
  });
});
