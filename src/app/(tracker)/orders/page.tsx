import { boardSummaries, listOrders } from '@/lib/tracker-db';
import { getBoard } from '@/lib/tracker-fields';
import { OrdersBoard } from '@/features/tracker/orders-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders | SD Tracker' };

export default function OrdersPage() {
  return (
    <OrdersBoard
      board={getBoard('orders')!}
      initialOrders={listOrders('orders')}
      summaries={boardSummaries()}
    />
  );
}
