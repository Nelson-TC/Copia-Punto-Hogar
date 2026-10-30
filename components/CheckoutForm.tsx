"use client";
import { useState, useEffect } from 'react';
import { createOrder, OrderError } from '../src/lib/cart';
import { formatCurrency } from '../src/lib/format';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';

interface Props { total: number; blocked?: boolean }

const inputCls = 'w-full border rounded px-3 py-2 text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-carrot focus:border-carrot transition';

export default function CheckoutForm({ total, blocked = false }: Props) {
  const [form, setForm] = useState({ customer: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const { session } = useAuth();

  useEffect(()=>{
    if (session) {
      setForm(f => ({ ...f, email: f.email || session.email || '', customer: f.customer || '' }));
    }
  },[session]);
  const router = useRouter();

  // Misma validación que el servidor, para bloquear el envío con datos inválidos.
  function validate() {
    const e: Record<string,string> = {};
    if (form.customer.trim().length < 2) e.customer = 'Ingresa tu nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Correo electrónico inválido.';
    if (!/^[+0-9 ()-]{5,}$/.test(form.phone.trim())) e.phone = 'Teléfono inválido (solo números, +, espacios y guiones).';
    if (form.address.trim().length < 5) e.address = 'Ingresa una dirección de envío completa.';
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || blocked) return;
    setError(null);
    const local = validate();
    setFieldErrors(local);
    if (Object.keys(local).length) return;
    setLoading(true);
    try {
      const order = await createOrder(form);
      router.push(`/orders/${order.id}`);
    } catch (err: any) {
      if (err instanceof OrderError && err.code === 'UNAUTHENTICATED') {
        router.push('/login?next=/checkout');
        return;
      }
      if (err?.fields) setFieldErrors(err.fields);
      // Si falta inventario el servidor lista qué productos ya no alcanzan y no descuenta nada.
      setError(err?.message || 'Error creando el pedido');
    } finally { setLoading(false); }
  }

  function set<K extends keyof typeof form>(key: K, value: string) { setForm(f => ({ ...f, [key]: value })); }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 p-5 border rounded-lg bg-surface shadow-sm">
      <h2 className="text-lg font-semibold text-nav">Datos de envío</h2>
      <div className="space-y-3">
        <div>
          <input required aria-label="Nombre" value={form.customer} onChange={e=>set('customer', e.target.value)} placeholder="Nombre" className={inputCls} />
          {fieldErrors.customer && <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.customer}</p>}
        </div>
        <div>
          <input required aria-label="Email" type="email" value={form.email} onChange={e=>set('email', e.target.value)} placeholder="Email" className={inputCls} />
          {fieldErrors.email && <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.email}</p>}
        </div>
        <div>
          <input required aria-label="Teléfono" value={form.phone} onChange={e=>set('phone', e.target.value)} placeholder="Teléfono" className={inputCls} />
          {fieldErrors.phone && <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.phone}</p>}
        </div>
        <div>
          <textarea required aria-label="Dirección" value={form.address} onChange={e=>set('address', e.target.value)} placeholder="Dirección" className={`${inputCls} min-h-[80px]`} />
          {fieldErrors.address && <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.address}</p>}
        </div>
      </div>
      <div className="text-sm flex justify-between font-medium">
        <span>Total a pagar:</span>
        <span>{formatCurrency(total)}</span>
      </div>
      {error && (
        <div role="alert" data-testid="checkout-error" className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
          <p>{error}</p>
          {!Object.keys(fieldErrors).length && (
            <a href="/cart" className="inline-block mt-1 font-semibold underline">Revisar mi carrito</a>
          )}
        </div>
      )}
      <button type="submit" disabled={loading || blocked} className="w-full px-4 py-2 text-sm font-semibold text-nav rounded bg-carrot hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav disabled:opacity-50 disabled:cursor-not-allowed transition">
        {loading ? 'Procesando…' : blocked ? 'Ajusta tu carrito para continuar' : 'Confirmar pedido'}
      </button>
    </form>
  );
}
