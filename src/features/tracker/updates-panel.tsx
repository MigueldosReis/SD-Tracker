'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OWNERS } from '@/lib/tracker-fields';
import { mentions } from '@/lib/attention';
import { fmtDateTime } from './shared';

type Update = { n: number; at: string; author: string | null; text: string };
const AUTHOR_KEY = 'sd-tracker:author';

function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Update text with @mentions of team members highlighted. */
export function MentionText({ text }: { text: string }) {
  const names = mentions(text);
  if (names.length === 0) return <>{text}</>;
  const firsts = names.map((n) => n.split(' ')[0]).join('|');
  const parts = text.split(
    new RegExp(
      `(@(?:${firsts})(?:\\s+(?:${names.map((n) => n.split(' ').slice(1).join(' ')).join('|')}))?)`,
      'i'
    )
  );
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className='bg-primary/10 text-foreground rounded px-0.5 font-medium'>
            {p}
          </mark>
        ) : (
          p
        )
      )}
    </>
  );
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** The conversation on an order: write an update, see everyone's updates, newest first. */
export function UpdatesPanel({
  orderId,
  onCount
}: {
  orderId: string;
  onCount: (n: number) => void;
}) {
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [text, setText] = useState('');
  // Who is posting: remembered on this device; empty until the browser is available (no hydration mismatch).
  const stored = useSyncExternalStore(
    () => () => {},
    readAuthor,
    () => ''
  );
  const [picked, setPicked] = useState<string | null>(null);
  const author = picked ?? stored;
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/tracker/orders/${encodeURIComponent(orderId)}/updates`)
      .then((r) => (r.ok ? r.json() : { updates: [] }))
      .then((d) => {
        if (live) setUpdates(d.updates ?? []);
      })
      .catch(() => {
        if (live) setUpdates([]);
      });
    return () => {
      live = false;
    };
  }, [orderId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(orderId)}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author })
    });
    const data = await res.json().catch(() => ({}));
    setPosting(false);
    if (!res.ok) {
      toast.error(
        String(data.error ?? 'Could not post the update. Refresh the page and try again.')
      );
      return;
    }
    setUpdates(data.updates as Update[]);
    onCount((data.updates as Update[]).length);
    setText('');
    toast.success('Update posted');
  }

  return (
    <div className='flex flex-col gap-5'>
      <form onSubmit={post} className='flex flex-col gap-2'>
        <Textarea
          id='update-text'
          name='update'
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label='Write an update'
          placeholder='Write an update. Type @ and a name to mention someone, e.g. @Jordan supplier confirmed Tuesday…'
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(e);
          }}
        />
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Select
            value={author || null}
            onValueChange={(v) => {
              const a = String(v ?? '');
              setPicked(a);
              try {
                localStorage.setItem(AUTHOR_KEY, a);
              } catch {
                /* not available */
              }
            }}
          >
            <SelectTrigger size='sm' className='w-48' aria-label='Posting as'>
              <SelectValue placeholder='Posting as…' />
            </SelectTrigger>
            <SelectContent>
              {OWNERS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type='submit' disabled={posting || !text.trim()}>
            {posting ? <Icons.spinner className='animate-spin' /> : <Icons.send />}
            Post Update
          </Button>
        </div>
      </form>
      {updates === null && (
        <p className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Icons.spinner className='size-4 animate-spin' />
          Loading…
        </p>
      )}
      {updates?.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          No updates yet. Post the latest news on this order so everyone sees it in one place.
        </p>
      )}
      {updates && updates.length > 0 && (
        <ol className='flex flex-col gap-3'>
          {updates.map((u) => (
            <li key={u.n} className='rounded-xl border p-3'>
              <div className='mb-1 flex items-center gap-2 text-sm'>
                <span
                  aria-hidden
                  className='bg-muted flex size-7 items-center justify-center rounded-full text-xs font-medium'
                >
                  {initials(u.author ?? '?')}
                </span>
                <span className='font-medium'>{u.author || 'Someone'}</span>
                <time className='text-muted-foreground text-xs tabular-nums' dateTime={u.at}>
                  {fmtDateTime(u.at)}
                </time>
              </div>
              <p className='text-sm break-words whitespace-pre-wrap'>
                <MentionText text={u.text} />
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
