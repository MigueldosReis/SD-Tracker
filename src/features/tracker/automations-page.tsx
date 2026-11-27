'use client';

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DOC_CHASES } from '@/lib/attention';
import { AUTOMATIONS } from '@/lib/automations';
import { STATUS_REQUIRES, getBoard } from '@/lib/tracker-fields';
import { FOLLOW_UP_WORKING_DAYS } from '@/lib/working-days';
import { boardHref, fmtDateTime, orderTitle, str, type Summary } from './shared';
import { TrackerShell } from './tracker-shell';

type Run = {
  at: string;
  orderId: string;
  text: string;
  board: string | null;
  customer: string | null;
  site: string | null;
  storeCode: string | null;
  ref: string | null;
};

const RULES: { title: string; detail: string }[] = [
  ...Object.entries(STATUS_REQUIRES).map(([status, r]) => ({
    title: `${status} needs the ${r.label.toLowerCase()}`,
    detail: 'The status cannot be set until it is filled in.'
  })),
  {
    title: 'Mr Price store codes',
    detail: 'MRP orders need a store code, and it is always added to the store name.'
  },
  {
    title: 'Landlord Approval fills itself',
    detail:
      'MRP Project Orders appear there while in landlord approval and leave when they move on.'
  }
];

const REMINDERS: { title: string; detail: string }[] = [
  {
    title: 'Ready to close',
    detail: 'Handover Sent for more than 2 working days: offered a one-click Mark Complete.'
  },
  {
    title: 'Booked date passed',
    detail: 'A survey, install or cutover date passed and the status did not move.'
  },
  {
    title: 'Late for their step',
    detail: 'Longer than the usual working days for the delivery step.'
  },
  ...DOC_CHASES.map((d) => ({
    title: `${d.label.replace(/ from the supplier| to the client/, '')} not back`,
    detail: `After ${d.days} working days.`
  })),
  {
    title: 'Follow-ups due',
    detail: `Every ${FOLLOW_UP_WORKING_DAYS} working days on follow-up boards, skipping weekends and SA public holidays.`
  }
];

const ruleOf = (text: string) => /^Automation \(([^)]+)\)/.exec(text)?.[1] ?? '';
const whatOf = (text: string) => text.replace(/^Automation \([^)]+\):\s*/, '');

/** What the tracker does automatically: rules it enforces, changes it makes, and reminders it raises. */
export function AutomationsPage({ runs, summaries }: { runs: Run[]; summaries: Summary[] }) {
  const counts = new Map<string, number>();
  for (const r of runs) counts.set(ruleOf(r.text), (counts.get(ruleOf(r.text)) ?? 0) + 1);

  return (
    <TrackerShell board={{ id: 'automations', title: 'Automations' }} summaries={summaries}>
      <div className='min-w-0'>
        <h1 className='text-2xl font-semibold tracking-tight text-balance'>Automations</h1>
        <p className='text-muted-foreground max-w-3xl text-sm text-pretty'>
          Built into the delivery rules and always on, for every board, every edit, bulk change and
          Kanban drag. Nothing to set up, and every change an automation makes is written to the
          order&apos;s activity log.
        </p>
      </div>

      <section aria-labelledby='auto-h' className='flex flex-col gap-3'>
        <h2 id='auto-h' className='font-semibold'>
          Changes made for you
        </h2>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {AUTOMATIONS.map((a) => (
            <Card key={a.id} className='gap-3 p-4'>
              <div className='flex items-start justify-between gap-2'>
                <h3 className='font-medium'>{a.title}</h3>
                <Badge
                  variant='secondary'
                  className='shrink-0 tabular-nums'
                  title='Runs in the last 30 days'
                >
                  {counts.get(a.title) ?? 0} runs
                </Badge>
              </div>
              <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm'>
                <dt className='text-muted-foreground'>When</dt>
                <dd>{a.when}</dd>
                <dt className='text-muted-foreground'>Then</dt>
                <dd>{a.action}</dd>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <section aria-labelledby='rules-h' className='flex flex-col gap-3'>
          <h2 id='rules-h' className='font-semibold'>
            Rules that keep data right
          </h2>
          <Card className='gap-0 divide-y py-0'>
            {RULES.map((r) => (
              <div key={r.title} className='flex gap-3 px-4 py-3 text-sm'>
                <Icons.lock aria-hidden className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                <div>
                  <div className='font-medium'>{r.title}</div>
                  <div className='text-muted-foreground'>{r.detail}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
        <section aria-labelledby='rem-h' className='flex flex-col gap-3'>
          <h2 id='rem-h' className='font-semibold'>
            Reminders on My work
          </h2>
          <Card className='gap-0 divide-y py-0'>
            {REMINDERS.map((r) => (
              <div key={r.title} className='flex gap-3 px-4 py-3 text-sm'>
                <Icons.notification
                  aria-hidden
                  className='text-muted-foreground mt-0.5 size-4 shrink-0'
                />
                <div>
                  <div className='font-medium'>{r.title}</div>
                  <div className='text-muted-foreground'>{r.detail}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <section aria-labelledby='runs-h' className='flex flex-col gap-3'>
        <h2 id='runs-h' className='font-semibold'>
          Recent runs{' '}
          <span className='text-muted-foreground text-sm font-normal'>last 30 days</span>
        </h2>
        <Card className='gap-0 divide-y py-0'>
          {runs.length === 0 && (
            <p className='text-muted-foreground p-4 text-sm'>
              Nothing has run yet. Automations run when orders are edited, for example when an order
              is marked Complete.
            </p>
          )}
          {runs.slice(0, 50).map((r, i) => {
            const b = getBoard(String(r.board ?? 'orders'));
            const name = b ? orderTitle(b, r as never) : str(r.customer);
            return (
              <div
                key={`${r.orderId}-${r.at}-${i}`}
                className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm'
              >
                <time className='text-muted-foreground w-36 shrink-0 tabular-nums' dateTime={r.at}>
                  {fmtDateTime(r.at)}
                </time>
                <Badge variant='outline' className='font-normal'>
                  {ruleOf(r.text)}
                </Badge>
                <Link
                  className='font-medium hover:underline'
                  href={`${boardHref((b?.id ?? 'orders') as never)}?order=${encodeURIComponent(r.orderId)}`}
                >
                  {name}
                </Link>
                <span className='text-muted-foreground min-w-0'>{whatOf(r.text)}</span>
              </div>
            );
          })}
        </Card>
      </section>
    </TrackerShell>
  );
}
