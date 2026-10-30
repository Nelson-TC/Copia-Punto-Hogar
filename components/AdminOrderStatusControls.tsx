'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  current: string;
  canManage: boolean;
}

const STATUSES = ['PENDING','PAID','SHIPPED','COMPLETED','CANCELED'];

export function AdminOrderStatusControls({ orderId, current, canManage }: Props) {
  const router = useRouter();
  const [pendingTransition, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  if (!canManage) return null;

  async function updateStatus(next: string) {
    if (next === current) return;
    try {
      setLoading(next);
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error && data.code !== data.error ? data.error : 'No se pudo actualizar el estado');
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Cambiar estado</p>
      <div className="grid gap-2">
        {STATUSES.map(s => {
          const active = s === current;
          return (
            <button
              key={s}
              type="button"
              disabled={active || loading === s || pendingTransition}
              onClick={() => updateStatus(s)}
              className={`px-3 py-2 text-xs font-semibold rounded-md border transition text-left disabled:cursor-not-allowed disabled:opacity-70 ${active ? 'bg-carrot text-nav border-carrot' : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-700'}`}
            >{s}</button>
          );
        })}
      </div>
      <p className="text-[11px] text-neutral-500 leading-snug">Los cambios se registran en el log de auditoría. Al cancelar un pedido se devuelve el inventario; un pedido cancelado ya no puede cambiar de estado.</p>
    </div>
  );
}
