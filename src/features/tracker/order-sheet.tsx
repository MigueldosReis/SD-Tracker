'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  STORED_BOARDS,
  EDITABLE_FIELDS,
  MONEY_FIELDS,
  OWNERS,
  getBoard,
  type BoardDef,
  type Order,
  type OrderField
} from '@/lib/tracker-fields';
import { FOLLOW_UP_WORKING_DAYS } from '@/lib/working-days';
import {
  CLOSED,
  DATE_FIELDS,
  LABELS,
  SECTIONS,
  WIDE_FIELDS,
  followUpOf,
  fmtDate,
  fmtDateTime,
  isoDate,
  orderTitle,
  str,
  type LogEntry,
  type SaveResult
} from './shared';
import { FollowUpBadge, StatusBadge } from './status-controls';

const NONE = '__none__';

export function OrderSheet({
  board,
  order,
  statuses,
  groupNames,
  today,
  onClose,
  save,
  followUp,
  remove
}: {
  board: BoardDef;
  order: Order;
  statuses: string[];
  groupNames: string[];
  today: string;
  onClose: () => void;
  save: (id: string, body: Record<string, unknown>) => Promise<SaveResult>;
  followUp: (id: string, note?: string) => Promise<SaveResult>;
  remove: (id: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState(false);
  const dirty = Object.keys(draft).length > 0;

  async function loadLog() {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(order.id)}`);
    setLog(res.ok ? (((await res.json()).log ?? []) as LogEntry[]) : []);
  }

  function requestClose() {
    if (dirty && !window.confirm('Discard your unsaved changes to this order?')) return;
    onClose();
  }

  const value = (f: OrderField) =>
    f in draft ? draft[f] : DATE_FIELDS.has(f) ? isoDate(order[f]) : str(order[f]);
  const set = (f: string, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  async function onSave() {
    setSaving(true);
    setError(null);
    const r = await save(order.id, draft);
    setSaving(false);
    if (!r.ok) {
      setError({ message: r.error, field: r.field });
      if (r.field) document.getElementById(`f-${r.field}`)?.focus();
      return;
    }
    setDraft({});
    setLog(r.log);
    toast.success('Changes saved');
  }

  async function onFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setRecording(true);
    const r = await followUp(order.id, note);
    setRecording(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setNote('');
    setLog(r.log);
    toast.success('Follow-up recorded', {
      description: `Next one due in ${FOLLOW_UP_WORKING_DAYS} working days.`
    });
  }

  const select = (
    id: string,
    f: string,
    current: string,
    options: { value: string; label: string }[],
    onPick?: (v: string) => void
  ) => (
    <Select
      value={current || NONE}
      onValueChange={(v) => (onPick ?? ((x: string) => set(f, x)))(v === NONE ? '' : String(v))}
    >
      <SelectTrigger id={id} className='w-full' aria-invalid={error?.field === f || undefined}>
        <SelectValue>{(v: string) => options.find((o) => o.value === v)?.label ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const field = (f: OrderField) => {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(f)) return null;
    if (f === 'storeCode' && !board.mrp && !value(f)) return null;
    const id = `f-${f}`;
    const invalid = error?.field === f || undefined;
    let input;
    if (f === 'status') {
      const list = statuses.includes(value(f)) || !value(f) ? statuses : [value(f), ...statuses];
      input = select(
        id,
        f,
        value(f),
        list.map((s) => ({ value: s, label: s }))
      );
    } else if (f === 'board') {
      input = select(
        id,
        f,
        value(f),
        STORED_BOARDS.map((b) => ({ value: b.id, label: b.title })),
        (v) => {
          const target = getBoard(v);
          // Moving to another board puts the order in that board's first group.
          setDraft((d) => ({
            ...d,
            board: v,
            groupName: target && v !== order.board ? target.groups[0] : str(order.groupName)
          }));
        }
      );
    } else if (f === 'groupName') {
      const groups =
        draft.board && draft.board !== order.board
          ? [...(getBoard(draft.board)?.groups ?? []), ...CLOSED]
          : groupNames;
      const list = groups.includes(value(f)) ? groups : [value(f), ...groups];
      input = select(
        id,
        f,
        value(f),
        list.map((g) => ({ value: g, label: g }))
      );
    } else if (f === 'owner') {
      input = select(id, f, value(f), [
        { value: NONE, label: 'Unassigned' },
        ...OWNERS.map((o) => ({ value: o, label: o }))
      ]);
    } else if (WIDE_FIELDS.has(f)) {
      input = (
        <Textarea
          id={id}
          name={f}
          rows={3}
          value={value(f)}
          aria-invalid={invalid}
          onChange={(e) => set(f, e.target.value)}
        />
      );
    } else {
      const money = (MONEY_FIELDS as readonly string[]).includes(f);
      input = (
        <Input
          id={id}
          name={f}
          autoComplete='off'
          aria-invalid={invalid}
          type={DATE_FIELDS.has(f) ? 'date' : 'text'}
          inputMode={money ? 'decimal' : undefined}
          spellCheck={f === 'notes' ? undefined : false}
          className={
            money || f === 'circuit' || f === 'storeCode' ? 'font-mono tabular-nums' : undefined
          }
          value={value(f)}
          onChange={(e) => set(f, e.target.value)}
        />
      );
    }
    return (
      <Field key={f} className={WIDE_FIELDS.has(f) ? 'sm:col-span-2' : ''} data-invalid={invalid}>
        <FieldLabel htmlFor={id}>
          {LABELS[f] ?? f}
          {f === 'storeCode' && board.mrp && (
            <span className='text-muted-foreground font-normal'>(required)</span>
          )}
        </FieldLabel>
        {input}
        {f === 'site' && board.mrp && (
          <p className='text-muted-foreground text-xs'>
            The store code is added to the name automatically.
          </p>
        )}
      </Field>
    );
  };

  const fu = followUpOf(board, order, today);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <SheetContent className='w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl'>
        <SheetHeader className='border-b p-5 pr-12'>
          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge status={order.status} />
            <span className='text-muted-foreground text-xs'>{str(order.groupName)}</span>
          </div>
          <SheetTitle className='text-lg text-balance'>{orderTitle(board, order)}</SheetTitle>
          <SheetDescription className='truncate'>
            {board.mrp ? str(order.customer) : str(order.site) || 'No site name yet'}
            {order.circuit ? <span className='font-mono'> · {str(order.circuit)}</span> : null}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(t) => {
            setTab(String(t));
            if (t === 'activity' && log === null) void loadLog();
          }}
          className='min-h-0 flex-1 gap-0'
        >
          <TabsList variant='line' className='w-full justify-start border-b px-5'>
            <TabsTrigger value='details'>Details</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>

          <TabsContent
            value='details'
            className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-5'
          >
            <div className='flex flex-col gap-6'>
              {error && (
                <div
                  role='alert'
                  aria-live='polite'
                  className='border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm'
                >
                  <Icons.alertCircle aria-hidden className='mt-0.5 size-4 shrink-0' />
                  <span>{error.message}</span>
                </div>
              )}

              {fu && (
                <form onSubmit={onFollowUp} className='bg-muted/40 rounded-xl border p-4'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex items-center gap-2 text-sm font-medium'>
                      <Icons.phoneCall aria-hidden className='text-muted-foreground size-4' />
                      Next follow-up <FollowUpBadge due={fu.due} state={fu.state} />
                    </div>
                    <span className='text-muted-foreground text-xs'>
                      Last: {order.lastFollowUp ? fmtDate(order.lastFollowUp) : 'never'}
                    </span>
                  </div>
                  <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
                    <Input
                      aria-label='Follow-up note'
                      name='note'
                      autoComplete='off'
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder='What happened? e.g. Supplier confirmed survey for Tuesday…'
                      className='flex-1'
                    />
                    <Button type='submit' disabled={recording}>
                      {recording ? <Icons.spinner className='animate-spin' /> : <Icons.check />}
                      Followed Up Today
                    </Button>
                  </div>
                </form>
              )}

              {SECTIONS.map((s) => (
                <FieldSet key={s.title}>
                  <FieldLegend
                    variant='label'
                    className='text-muted-foreground text-xs tracking-wide uppercase'
                  >
                    {s.title}
                  </FieldLegend>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>{s.fields.map(field)}</div>
                </FieldSet>
              ))}

              <div className='border-destructive/30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-4'>
                <div className='text-sm'>
                  <div className='font-medium'>Delete this order</div>
                  <div className='text-muted-foreground text-xs'>
                    Removes the order and its activity log. This cannot be undone.
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant='destructive' size='sm' />}>
                    <Icons.trash /> Delete Order
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {orderTitle(board, order)}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The order and its activity log will be removed permanently.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Order</AlertDialogCancel>
                      <AlertDialogAction
                        variant='destructive'
                        onClick={async () => {
                          if (await remove(order.id)) toast.success('Order deleted');
                          else
                            toast.error(
                              'Could not delete this order. Refresh the page and try again.'
                            );
                        }}
                      >
                        Delete Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value='activity'
            className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-5'
          >
            {log === null && (
              <p className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Icons.spinner className='size-4 animate-spin' />
                Loading…
              </p>
            )}
            {log?.length === 0 && <p className='text-muted-foreground text-sm'>No activity yet.</p>}
            {log && log.length > 0 && (
              <ol className='relative ml-2 flex flex-col gap-4 border-l pl-5'>
                {log.map((l) => (
                  <li key={l.n} className='relative text-sm'>
                    <span
                      aria-hidden
                      className='bg-primary ring-background absolute top-1.5 -left-[25px] size-2 rounded-full ring-4'
                    />
                    <time
                      className='text-muted-foreground block text-xs tabular-nums'
                      dateTime={l.at}
                    >
                      {fmtDateTime(l.at)}
                    </time>
                    <p className='break-words'>{l.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        {tab === 'details' && (
          <SheetFooter className='flex-row items-center justify-between border-t p-4'>
            <span className='text-muted-foreground text-xs' aria-live='polite'>
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='ghost'
                disabled={!dirty || saving}
                onClick={() => {
                  setDraft({});
                  setError(null);
                }}
              >
                Discard
              </Button>
              <Button disabled={!dirty || saving} onClick={onSave}>
                {saving && <Icons.spinner className='animate-spin' />}
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
