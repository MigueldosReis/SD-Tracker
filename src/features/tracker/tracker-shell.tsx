'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { getBoard, type BoardDef } from '@/lib/tracker-fields';
import { BOARD_ICONS, boardHref, type Summary } from './shared';

const itemClass =
  'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&>svg]:text-sidebar-foreground/60 data-active:[&>svg:first-child]:text-sidebar-primary';

/** App frame for every tracker board: board navigation on the left, page header on top. */
export function TrackerShell({
  board,
  summaries,
  actions,
  children
}: {
  board: BoardDef;
  summaries: Summary[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <a
        href='#main'
        className='bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2'
      >
        Skip to content
      </a>
      <BoardsSidebar active={board.id} summaries={summaries} />
      <SidebarInset className='min-w-0'>
        <header className='bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-1 data-vertical:h-4' />
          <nav
            aria-label='Breadcrumb'
            className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm'
          >
            <span className='hidden sm:inline'>SD Tracker</span>
            <Icons.chevronRight aria-hidden className='hidden size-3.5 sm:inline' />
            <span className='text-foreground truncate font-medium'>{board.title}</span>
          </nav>
          <div className='ml-auto flex items-center gap-1'>
            {actions}
            <ThemeModeToggle />
          </div>
        </header>
        <main id='main' className='flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6'>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function BoardsSidebar({ active, summaries }: { active: string; summaries: Summary[] }) {
  const { setOpenMobile } = useSidebar();
  const main = summaries.filter((s) => s.id === 'orders');
  const isMrp = (s: Summary) => getBoard(s.id)?.mrp ?? false;
  const mrp = summaries.filter(isMrp);
  const chase = summaries.filter((s) => s.id !== 'orders' && !isMrp(s));
  const section = (label: string, items: Summary[]) => (
    <SidebarGroup className='group-data-[collapsible=icon]:px-1'>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu className='gap-0.5'>
        {items.map((s) => {
          const Icon = BOARD_ICONS[s.id];
          const isActive = s.id === active;
          return (
            <SidebarMenuItem key={s.id}>
              <SidebarMenuButton
                render={
                  <Link
                    href={boardHref(s.id)}
                    aria-label={s.title}
                    aria-current={isActive ? 'page' : undefined}
                  />
                }
                tooltip={`${s.title}: ${s.open} open${s.followUpsDue ? `, ${s.followUpsDue} follow-ups due` : ''}`}
                isActive={isActive}
                className={itemClass}
                onClick={() => setOpenMobile(false)}
              >
                <Icon />
                <span>{s.title}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge
                className={s.followUpsDue > 0 ? 'bg-destructive/15 text-destructive' : ''}
              >
                {s.followUpsDue > 0 ? (
                  <span>
                    <span className='sr-only'>Follow-ups due: </span>
                    {s.followUpsDue}
                  </span>
                ) : (
                  <span>
                    <span className='sr-only'>Open orders: </span>
                    {s.open}
                  </span>
                )}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader className='group-data-[collapsible=icon]:px-1'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              render={<Link href='/orders' aria-label='SD Tracker home' />}
              tooltip='SD Tracker'
            >
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                <Icons.router className='size-4' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>SD Tracker</span>
                <span className='text-muted-foreground truncate text-xs'>Service delivery</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        {section('Delivery', main)}
        {section('Mr Price', mrp)}
        {section('Follow-up boards', chase)}
      </SidebarContent>
      <SidebarFooter className='text-muted-foreground px-4 pb-3 text-xs group-data-[collapsible=icon]:hidden'>
        Red badges count follow-ups due today or overdue.
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
