import { describe, expect, test } from 'bun:test';
import { forOrderChange, forUpdate } from './notifications';

const team = ['Alex Mokoena', 'Priya Naidoo', 'Sam van Wyk'];

describe('forOrderChange', () => {
  test('new owner is told, unless they took it themselves', () => {
    expect(forOrderChange({ owner: null }, { owner: 'Priya Naidoo' }, 'Alex Mokoena')).toEqual([
      { recipient: 'Priya Naidoo', kind: 'assigned', text: 'Alex Mokoena made you the owner' }
    ]);
    expect(forOrderChange({ owner: null }, { owner: 'Priya Naidoo' }, 'Priya Naidoo')).toEqual([]);
  });

  test('owner hears about status changes made by others or by the system', () => {
    const before = { owner: 'Sam van Wyk', status: 'Awaiting Install Dates' };
    expect(
      forOrderChange(before, { ...before, status: 'Install Scheduled' }, 'Alex Mokoena')[0]
    ).toMatchObject({
      kind: 'status',
      text: 'Alex Mokoena changed the status to Install Scheduled'
    });
    expect(forOrderChange(before, { ...before, status: 'Install Scheduled' }, null)[0].text).toBe(
      'Status changed to Install Scheduled'
    );
    expect(
      forOrderChange(before, { ...before, status: 'Install Scheduled' }, 'Sam van Wyk')
    ).toEqual([]);
    expect(forOrderChange(before, before, 'Alex Mokoena')).toEqual([]);
  });

  test('no owner, nobody to tell', () => {
    expect(forOrderChange({ status: 'A' }, { status: 'B' }, 'Alex Mokoena')).toEqual([]);
  });
});

describe('forUpdate', () => {
  test('mentions and the owner are told once each, the author never', () => {
    const n = forUpdate('@Priya please check, @Alex FYI', 'Alex Mokoena', 'Priya Naidoo', team);
    expect(n.map((x) => [x.recipient, x.kind])).toEqual([['Priya Naidoo', 'mention']]);
    const m = forUpdate('Install booked for Friday', 'Priya Naidoo', 'Sam van Wyk', team);
    expect(m).toEqual([
      {
        recipient: 'Sam van Wyk',
        kind: 'update',
        text: 'Priya Naidoo posted an update: “Install booked for Friday”'
      }
    ]);
  });

  test('long updates are shortened', () => {
    const [n] = forUpdate(`@Sam ${'x'.repeat(300)}`, null, null, team);
    expect(n.text.startsWith('Someone mentioned you: “@Sam')).toBe(true);
    expect(n.text.length).toBeLessThan(180);
  });
});
