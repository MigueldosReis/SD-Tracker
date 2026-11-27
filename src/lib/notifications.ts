// Who gets told about what. Pure: tracker-db.ts calls these when orders change or updates are posted.
import { mentions } from './attention';

export type NotificationKind = 'mention' | 'assigned' | 'status' | 'update';
export type NewNotification = { recipient: string; kind: NotificationKind; text: string };

const who = (actor: string | null) => actor ?? 'Someone';
const excerpt = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 139)}…` : t;
};

/** An order's owner or status changed: tell the (new) owner, unless they made the change themselves. */
export function forOrderChange(
  before: { owner?: unknown; status?: unknown },
  after: { owner?: unknown; status?: unknown },
  actor: string | null
): NewNotification[] {
  const owner = after.owner ? String(after.owner) : '';
  if (!owner || owner === actor) return [];
  if (owner !== String(before.owner ?? ''))
    return [{ recipient: owner, kind: 'assigned', text: `${who(actor)} made you the owner` }];
  if (after.status && after.status !== before.status)
    return [
      {
        recipient: owner,
        kind: 'status',
        text: actor
          ? `${actor} changed the status to ${after.status}`
          : `Status changed to ${after.status}`
      }
    ];
  return [];
}

/** An update was posted: tell everyone it @mentions, and the order's owner, but never the author. */
export function forUpdate(
  text: string,
  author: string | null,
  owner: unknown,
  people: readonly string[]
): NewNotification[] {
  const out: NewNotification[] = mentions(text, people)
    .filter((p) => p !== author)
    .map((p) => ({
      recipient: p,
      kind: 'mention',
      text: `${who(author)} mentioned you: “${excerpt(text)}”`
    }));
  const o = owner ? String(owner) : '';
  if (o && o !== author && !out.some((n) => n.recipient === o))
    out.push({
      recipient: o,
      kind: 'update',
      text: `${who(author)} posted an update: “${excerpt(text)}”`
    });
  return out;
}
