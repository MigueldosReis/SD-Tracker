import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'SD Tracker',
  description: 'Service delivery tracking for connectivity orders'
};

// Separate root layout from the starter pages: no sign-in provider, so the tracker runs without keys.
export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className='dark' data-theme='default' suppressHydrationWarning>
      <body className='bg-background text-foreground min-h-dvh font-sans antialiased'>{children}</body>
    </html>
  );
}
