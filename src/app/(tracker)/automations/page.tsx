import { automationRuns, boardSummaries } from '@/lib/tracker-db';
import { AutomationsPage } from '@/features/tracker/automations-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations | SD Tracker' };

export default function Automations() {
  return <AutomationsPage runs={automationRuns()} summaries={boardSummaries()} />;
}
