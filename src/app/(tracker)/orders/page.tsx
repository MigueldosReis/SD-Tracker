import { listOrders } from '@/lib/tracker-db';
import { OrdersBoard } from '@/features/tracker/orders-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders | SD Tracker' };

export default function OrdersPage() {
  return <OrdersBoard initialOrders={listOrders()} />;
}
