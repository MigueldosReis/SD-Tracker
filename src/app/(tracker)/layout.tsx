import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { fontVariables } from '@/components/themes/font.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { readTeam } from '@/lib/team';
import { TeamProvider } from '@/features/tracker/team-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'SD Tracker',
  description: 'Service delivery tracking for connectivity orders'
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' }
  ]
};

// Separate root layout from the starter pages: no sign-in provider, so the tracker runs without keys.
export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' data-theme='sd' suppressHydrationWarning>
      <body
        className={cn(
          'bg-background text-foreground min-h-dvh overflow-x-hidden font-sans antialiased',
          fontVariables
        )}
      >
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <TooltipProvider>
              <TeamProvider people={readTeam()}>{children}</TeamProvider>
              <Toaster richColors closeButton position='bottom-right' />
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
