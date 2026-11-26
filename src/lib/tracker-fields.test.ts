import { describe, expect, test } from 'bun:test';
import { belongsTo, boardFor, getBoard, isStoredBoardId } from './tracker-fields';

describe('boards', () => {
  const landlord = getBoard('landlord-approval')!;
  test('Landlord Approval shows only MRP project orders in a landlord status', () => {
    expect(
      belongsTo(landlord, { board: 'mrp-projects', status: 'Awaiting Landlord Approval' })
    ).toBe(true);
    expect(
      belongsTo(landlord, { board: 'mrp-projects', status: 'Awaiting Landlord Docs - Client' })
    ).toBe(true);
    expect(belongsTo(landlord, { board: 'mrp-projects', status: 'Install Scheduled' })).toBe(false);
    expect(
      belongsTo(landlord, { board: 'mrp-new-stores', status: 'Awaiting Landlord Approval' })
    ).toBe(false);
    expect(belongsTo(landlord, { board: 'orders', status: 'Awaiting Landlord Approval' })).toBe(
      false
    );
  });
  test('orders cannot be stored on a view board', () => {
    expect(isStoredBoardId('landlord-approval')).toBe(false);
    expect(isStoredBoardId('mrp-projects')).toBe(true);
    expect(boardFor({ groupName: 'Awaiting Landlord Approval', customer: 'Clicks' })).toBe(
      'orders'
    );
  });
  test('Mr Price orders go to the MRP boards', () => {
    expect(
      boardFor({
        groupName: 'Completed',
        customer: 'Mr Price Group',
        ref: '#New Store Mr Price Kids 11099'
      })
    ).toBe('mrp-new-stores');
    expect(
      boardFor({ groupName: 'Completed', customer: 'Mr Price Group', ref: 'Mr Price - 10441' })
    ).toBe('mrp-projects');
    expect(boardFor({ groupName: 'Open Orders', customer: 'Clicks' })).toBe('orders');
  });
});
