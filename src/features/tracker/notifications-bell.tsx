'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getBoard, type BoardId, type Order } from '@/lib/tracker-fields';
import { cn } from '@/lib/utils';
import { boardHref, currentPerson, orderTitle, PERSON_EVENT, personHeaders } from './shared';

type Item = {
  n: number;
  kind: 'mention' | 'assigned' | 'status' | 'update';
  orderId: string;
  actor: string | null;
  text: string;
  at: string;
  readAt: string | null;
  board: string | null;
  customer: string | null;
  site: string | null;
  storeCode: string | null;
  ref: string | null;
};

const POLL_MS = 30_000;
const KIND_ICON = {
  mention: Icons.slash,
  assigned: Icons.user,
  status: Icons.checks,
  update: Icons.chat
} as const;
const RTF = new Intl.RelativeTimeFormat('en-ZA', { numeric: 'auto' });

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return RTF.format(-Math.floor(s / 60), 'minute');
  if (s < 86_400) return RTF.format(-Math.floor(s / 3600), 'hour');
  return RTF.format(-Math.floor(s / 86_400), 'day');
}

// Who is using this device, kept in the browser; the server render has nobody.
const subscribePerson = (cb: () => void) => {
  window.addEventListener(PERSON_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(PERSON_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

const titleOf = (x: Item) => {
  const b = getBoard(x.board ?? 'orders');
  return b ? orderTitle(b, x as unknown as Order) : x.customer || 'Order';
};
const hrefOf = (x: Item) =>
  `${boardHref((getBoard(x.board ?? 'orders')?.id ?? 'orders') as BoardId)}?order=${encodeURIComponent(x.orderId)}`;

/**
 * Bell in the page header: mentions, orders you were made owner of, status changes and updates on your orders.
 * Checks every 30 seconds while the page is open; new ones pop up as a toast (and a desktop alert if allowed).
 */
export function NotificationsBell() {
  const router = useRouter();
  const me = useSyncExternalStore(subscribePerson, currentPerson, () => '');
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Read when the popover renders (client only); bumped after asking, as the browser has no change event.
  const [, setAsked] = useState(0);
  const desktop = typeof window === 'undefined' ? 'unsupported' : permission();
  const seen = useRef<number | null>(null); // highest notification number already shown

  const apply = useCallback((data: { items: Item[]; unread: number }) => {
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  const load = useCallback(async () => {
    if (!currentPerson()) return;
    const res = await fetch('/api/tracker/notifications', { headers: personHeaders() }).catch(
      () => null
    );
    if (!res?.ok) return;
    const data = (await res.json()) as { items: Item[]; unread: number };
    apply(data);
    const top = data.items[0]?.n ?? 0;
    // Announce only what arrived since the last check, never the backlog on page load.
    if (seen.current !== null) {
      const fresh = data.items.filter((x) => x.n > seen.current! && !x.readAt).toReversed();
      for (const x of fresh.slice(-3)) {
        toast(titleOf(x), {
          description: x.text,
          action: { label: 'Open', onClick: () => router.push(hrefOf(x)) }
        });
        if (document.hidden && permission() === 'granted') {
          const alert = new Notification(`SD Tracker: ${titleOf(x)}`, {
            body: x.text,
            tag: `sd-${x.n}`
          });
          alert.addEventListener('click', () => {
            window.focus();
            router.push(hrefOf(x));
          });
        }
      }
    }
    seen.current = Math.max(seen.current ?? 0, top);
  }, [apply, router]);

  // Load when the person changes, then every 30 seconds and whenever the page comes back into view.
  useEffect(() => {
    seen.current = null;
    if (!me) return;
    // load() only sets state after the fetch resolves, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
    const tick = () => {
      if (!document.hidden) void load();
    };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [me, load]);

  async function markRead(n?: number) {
    const res = await fetch('/api/tracker/notifications', {
      method: 'POST',
      headers: personHeaders(),
      body: JSON.stringify(n === undefined ? {} : { n })
    }).catch(() => null);
    if (res?.ok) apply(await res.json());
    else toast.error('Could not mark notifications as read. Check your connection and try again.');
  }

  function openItem(x: Item) {
    setOpen(false);
    if (!x.readAt) void markRead(x.n);
    router.push(hrefOf(x));
  }

  async function enableDesktop() {
    const p = await Notification.requestPermission();
    setAsked((n) => n + 1);
    if (p === 'granted') toast.success('Desktop alerts are on while this page is open.');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className='text-muted-foreground hover:text-foreground relative'
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <Icons.notification />
        {unread > 0 && (
          <span
            aria-hidden
            className='bg-destructive ring-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums ring-2'
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align='end' sideOffset={8} className='w-[calc(100vw-2rem)] p-0 sm:w-96'>
        <div className='flex h-11 items-center justify-between gap-2 border-b px-3'>
          <h2 className='text-sm font-semibold'>
            Notifications
            {me && <span className='text-muted-foreground font-normal'> for {me}</span>}
          </h2>
          {unread > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs'
              onClick={() => void markRead()}
            >
              Mark All as Read
            </Button>
          )}
        </div>
        {!me ? (
          <div className='flex flex-col items-center gap-2 px-6 py-10 text-center text-sm'>
            <Icons.notification aria-hidden className='text-muted-foreground size-6' />
            <p className='font-medium'>Choose who you are first</p>
            <p className='text-muted-foreground text-pretty'>
              Pick your name on My work, or under &ldquo;Posting as&rdquo; on an order&apos;s
              updates. Notifications are kept per person.
            </p>
            <Button
              size='sm'
              variant='outline'
              nativeButton={false}
              render={
                <Link href='/my-work' aria-label='Go to My Work' onClick={() => setOpen(false)} />
              }
            >
              Go to My Work
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 px-6 py-10 text-center text-sm'>
            <Icons.checks aria-hidden className='size-6' />
            <p>
              Nothing yet. You&apos;ll hear here when someone @mentions you, makes you the owner of
              an order, or changes or updates one of your orders.
            </p>
          </div>
        ) : (
          <ScrollArea className='max-h-[420px]'>
            <ul className='flex flex-col p-1'>
              {items.map((x) => {
                const Icon = KIND_ICON[x.kind] ?? Icons.notification;
                return (
                  <li key={x.n}>
                    <button
                      type='button'
                      onClick={() => openItem(x)}
                      className='hover:bg-muted focus-visible:ring-ring flex w-full gap-3 rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-3'
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5',
                          x.readAt ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                        )}
                      >
                        <Icon />
                      </span>
                      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                        <span
                          className={cn(
                            'truncate text-sm',
                            x.readAt ? 'font-normal' : 'font-semibold'
                          )}
                        >
                          {titleOf(x)}
                        </span>
                        <span className='text-muted-foreground line-clamp-2 text-xs break-words'>
                          {x.text}
                        </span>
                        <time dateTime={x.at} className='text-muted-foreground text-[11px]'>
                          {ago(x.at)}
                        </time>
                      </span>
                      {!x.readAt && (
                        <span className='bg-primary mt-2 size-2 shrink-0 rounded-full'>
                          <span className='sr-only'>Unread</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        {me && desktop === 'default' && (
          <div className='border-t px-3 py-2'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 w-full text-xs'
              onClick={() => void enableDesktop()}
            >
              Turn On Desktop Alerts
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
