import { boardSummaries, listOpenOrders, recentUpdates } from '@/lib/tracker-db';
import { MyWork } from '@/features/tracker/my-work';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My work | SD Tracker' };

export default function MyWorkPage() {
  return (
    <MyWork
      initialOrders={listOpenOrders()}
      updates={recentUpdates()}
      summaries={boardSummaries()}
    />
  );
}
