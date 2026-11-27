'use client';

import { Icons } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OTHER_STATUSES, PROCESS_STATUSES } from '@/lib/tracker-fields';
import type { FollowUpState } from '@/lib/working-days';
import { cn } from '@/lib/utils';
import { fmtDate } from './shared';
import { statusColor } from './status-style';

/** Solid status colour chip (one distinct colour per status). */
export function StatusBadge({ status, className }: { status: unknown; className?: string }) {
  const s = status === null || status === undefined ? '' : String(status);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white',
        className
      )}
      style={{ background: statusColor(s) }}
    >
      <span className='truncate'>{s || 'No status'}</span>
    </span>
  );
}

/** Status chip that opens a menu of the 16 delivery steps (and legacy statuses, kept as they are). */
export function StatusMenu({
  status,
  label,
  onChange
}: {
  status: string;
  label: string;
  onChange: (s: string) => void;
}) {
  const legacy = status && ![...PROCESS_STATUSES, ...OTHER_STATUSES].includes(status as never);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Change status for ${label} (now ${status || 'no status'})`}
        className='focus-visible:ring-ring inline-flex max-w-full items-center gap-1 rounded-md text-white outline-none focus-visible:ring-3'
        style={{ background: statusColor(status) }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className='truncate px-2 py-0.5 text-xs font-medium'>{status || 'No status'}</span>
        <Icons.chevronDown aria-hidden className='mr-1 size-3.5 shrink-0 opacity-80' />
      </DropdownMenuTrigger>
      <DropdownMenuContent className='max-h-96 w-72' onClick={(e) => e.stopPropagation()}>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(v) => v !== status && onChange(String(v))}
        >
          {legacy && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Current (legacy)</DropdownMenuLabel>
                <DropdownMenuRadioItem value={status} closeOnClick>
                  <Swatch status={status} />
                  {status}
                </DropdownMenuRadioItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Delivery steps</DropdownMenuLabel>
            {PROCESS_STATUSES.map((s, i) => (
              <DropdownMenuRadioItem key={s} value={s} closeOnClick>
                <Swatch status={s} />
                <span className='text-muted-foreground w-5 text-right text-xs tabular-nums'>
                  {i + 1}
                </span>
                {s}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {OTHER_STATUSES.map((s) => (
              <DropdownMenuRadioItem key={s} value={s} closeOnClick>
                <Swatch status={s} />
                {s}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Swatch({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      className='size-2.5 shrink-0 rounded-sm'
      style={{ background: statusColor(status) }}
    />
  );
}

const FOLLOW_UP_CLASS: Record<FollowUpState, string> = {
  overdue: 'bg-destructive/15 text-destructive ring-destructive/30',
  due: 'bg-amber-500/15 text-amber-700 ring-amber-500/40 dark:text-amber-400',
  upcoming: 'bg-muted text-muted-foreground ring-border'
};
const FOLLOW_UP_TEXT: Record<FollowUpState, string> = {
  overdue: 'Overdue',
  due: 'Due today',
  upcoming: 'Upcoming'
};

export function FollowUpBadge({ due, state }: { due: string; state: FollowUpState }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
          FOLLOW_UP_CLASS[state]
        )}
      >
        {state === 'overdue' && <Icons.alertCircle aria-hidden className='size-3.5' />}
        {state === 'due' && <Icons.clock aria-hidden className='size-3.5' />}
        <span className='sr-only'>{FOLLOW_UP_TEXT[state]}: </span>
        {fmtDate(due, true)}
      </TooltipTrigger>
      <TooltipContent>
        {FOLLOW_UP_TEXT[state]} · {fmtDate(due)}
      </TooltipContent>
    </Tooltip>
  );
}
