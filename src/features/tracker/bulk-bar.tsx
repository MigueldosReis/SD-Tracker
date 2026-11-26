'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { OTHER_STATUSES, PROCESS_STATUSES } from '@/lib/tracker-fields';
import { useTeam } from './team-context';

const NONE = '__none__';

/** Floating bar for the selected rows: change status, owner or group for all of them at once, or delete them. */
export function BulkBar({
  count,
  groups,
  busy,
  onApply,
  onDelete,
  onClear
}: {
  count: number;
  groups: string[];
  busy: boolean;
  onApply: (patch: Record<string, string>, label: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const team = useTeam();
  const [key, setKey] = useState(0); // reset the pickers after each action
  const pick = (
    placeholder: string,
    onPick: (v: string) => void,
    children: React.ReactNode,
    width = 'w-48'
  ) => (
    <Select
      key={`${placeholder}-${key}`}
      onValueChange={(v) => {
        if (v) {
          onPick(String(v));
          setKey((k) => k + 1);
        }
      }}
      disabled={busy}
    >
      <SelectTrigger size='sm' className={width} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
  return (
    <div
      role='toolbar'
      aria-label={`${count} selected orders`}
      className='bg-popover text-popover-foreground fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-xl border p-2 shadow-lg'
    >
      <Button variant='ghost' size='icon-sm' aria-label='Clear selection' onClick={onClear}>
        <Icons.close />
      </Button>
      <span className='px-1 text-sm font-medium tabular-nums'>{count} selected</span>
      {pick(
        'Set status…',
        (s) => onApply({ status: s }, `Status set to ${s}`),
        <>
          <SelectGroup>
            <SelectLabel>Delivery steps</SelectLabel>
            {PROCESS_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            {OTHER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectGroup>
        </>,
        'w-52'
      )}
      {pick(
        'Set owner…',
        (v) =>
          onApply(
            { owner: v === NONE ? '' : v },
            v === NONE ? 'Owner removed' : `Owner set to ${v}`
          ),
        <>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {team.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </>,
        'w-44'
      )}
      {pick(
        'Move to group…',
        (g) => onApply({ groupName: g }, `Moved to ${g}`),
        groups.map((g) => (
          <SelectItem key={g} value={g}>
            {g}
          </SelectItem>
        ))
      )}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant='destructive' size='sm' disabled={busy} />}>
          <Icons.trash /> Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} {count === 1 ? 'order' : 'orders'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The orders, their updates and their activity logs are removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Orders</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={onDelete}>
              Delete {count} {count === 1 ? 'Order' : 'Orders'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {busy && <Icons.spinner aria-label='Working' className='size-4 animate-spin' />}
    </div>
  );
}
