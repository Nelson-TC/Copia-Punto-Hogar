import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ORDER_STATUS_BADGE, orderStatusLabel } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

export default async function MyOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account/orders');
  const userId = session.sub;

  // @ts-ignore prisma types stale
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return (
    <div className="max-w-5xl py-10 mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
        <Link href="/account" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded border-neutral-300 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">
          <i className='bx bx-user text-base'/> Mi cuenta
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="p-6 text-sm text-center border rounded-lg bg-surface text-neutral-500">Aún no has realizado pedidos.
          <div className="mt-4">
            <Link href="/products" className="inline-block px-4 py-2 text-xs font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Explorar productos</Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden border rounded-lg shadow-sm bg-surface">
          <ul className="divide-y">
            {orders.map((o:any) => {
              const itemsCount = o.items.reduce((s:number,i:any)=> s + i.quantity, 0);
              const smallId = o.id.slice(0,8);
              return (
                <li key={o.id} className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center md:gap-6">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 font-medium text-nav">
                      Pedido #{smallId}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[o.status] || 'bg-neutral-100 text-neutral-700'}`}>{orderStatusLabel(o.status)}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{o.createdAt.toISOString().slice(0,10)}</span>
                      <span>{itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 line-clamp-1">{o.items.map((i:any)=> `${i.quantity}× ${i.name}`).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="font-semibold tabular-nums text-neutral-700">{formatCurrency(Number(o.total))}</div>
                    <Link href={`/orders/${o.id}`} className="px-3 py-1 text-xs font-medium border rounded border-neutral-300 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot">Ver detalle</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
