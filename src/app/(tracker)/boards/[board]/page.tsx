import { notFound } from 'next/navigation';
import { boardSummaries, listOrders } from '@/lib/tracker-db';
import { getBoard } from '@/lib/tracker-fields';
import { OrdersBoard } from '@/features/tracker/orders-board';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ board: string }> };

export async function generateMetadata({ params }: Props) {
  const board = getBoard((await params).board);
  return { title: `${board?.title ?? 'Board'} | SD Tracker` };
}

export default async function BoardPage({ params }: Props) {
  const board = getBoard((await params).board);
  if (!board || board.id === 'orders') notFound();
  return (
    <OrdersBoard board={board} initialOrders={listOrders(board.id)} summaries={boardSummaries()} />
  );
}
