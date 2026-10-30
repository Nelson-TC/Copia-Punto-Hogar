"use client";
import { useEffect, useRef, useState } from 'react';
import { getCart, updateItem, removeItem, CartItem, EnrichedCartItem } from '../../src/lib/cart';
import { formatCurrency } from '../../src/lib/format';
import { showToast } from 'nextjs-toast-notify';

interface Row extends CartItem { name?: string; price?: number; lineTotal?: number; slug?: string; imageUrl?: string | null; stock?: number }

export default function CartPage() {
	const [items, setItems] = useState<Row[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [issues, setIssues] = useState<string[]>([]);
	const [updating, setUpdating] = useState<string | null>(null);
	const [optimistic, setOptimistic] = useState<Row[]>([]); // para UI optimista
	const [emptying, setEmptying] = useState(false);
	const isOptimistic = optimistic.length > 0;

	// Debounce de cambios de cantidad (un timer por producto, estable entre renders)
	const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

	async function load() {
		try {
			setLoading(true);
			setError(null);
			const cart = await getCart();
			if (cart.enriched) {
				const enriched = cart.enriched as EnrichedCartItem[];
				setItems(enriched.map(e => ({ ...e })));
			} else {
				setItems(cart.items.map(i => ({ ...i, name: i.productId })));
			}
			setIssues(cart.issues || []);
		} catch (e: any) { setError(e.message); } finally { setLoading(false); }
	}

	useEffect(() => { load(); }, []);

	function applyOptimistic(productId: string, qty: number) {
		setOptimistic(prev => {
			const base = prev.length ? [...prev] : [...items];
			const idx = base.findIndex(i => i.productId === productId);
			if (idx !== -1) {
				if (qty <= 0) base.splice(idx, 1); else base[idx] = { ...base[idx], qty, lineTotal: (base[idx].price || 0) * qty };
			}
			return base;
		});
	}

	async function commitQty(productId: string, qty: number) {
		try {
			setUpdating(productId);
			await updateItem(productId, qty);
		} catch (e: any) {
			// Ej.: "Solo hay 3 unidades disponibles de ..." (el servidor valida contra el inventario)
			showToast.error(e?.message || 'Error', { duration: 3500, position: 'top-right' });
		} finally {
			setUpdating(null);
			setOptimistic([]);
			await load(); // siempre se vuelve a sincronizar con lo que realmente quedó en el servidor
		}
	}

	function changeQty(productId: string, qty: number, stock?: number) {
		if (Number.isNaN(qty) || qty < 0) qty = 0;
		if (stock !== undefined && qty > stock) {
			showToast.error(`Solo hay ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'}.`, { duration: 2800, position: 'top-right' });
			qty = stock;
		}
		applyOptimistic(productId, qty);
		const timers = pendingTimers.current;
		const prev = timers.get(productId);
		if (prev) clearTimeout(prev);
		timers.set(productId, setTimeout(() => commitQty(productId, qty), 500));
	}

	async function remove(productId: string) {
		try {
			setUpdating(productId);
			setOptimistic(prev => prev.length ? prev.filter(i => i.productId !== productId) : items.filter(i => i.productId !== productId));
			await removeItem(productId);
			showToast.success('Eliminado del carrito', { duration: 1600, position: 'top-right' });
			await load();
		} catch (e: any) { setError(e.message); showToast.error(e?.message || 'Error', { duration: 2500, position: 'top-right' }); }
		finally { setUpdating(null); setOptimistic([]); }
	}

	async function emptyCart() {
		if (!items.length) return;
		try {
			setEmptying(true);
			for (const it of items) {
				await removeItem(it.productId);
			}
			showToast.success('Carrito vaciado', { duration: 1800, position: 'top-right' });
			await load();
		} catch (e: any) { setError(e.message); showToast.error(e?.message || 'Error', { duration: 2500, position: 'top-right' }); }
		finally { setEmptying(false); }
	}

	const effective = isOptimistic ? optimistic : items;
	const totalQty = effective.reduce((sum, i) => sum + i.qty, 0);
	// Los precios publicados ya incluyen IVA, así que el total coincide con el del pedido que se registra.
	const total = effective.reduce((s, i) => s + (i.lineTotal || 0), 0);
	const blocked = issues.length > 0;

	const Skeleton = () => (
		<li className="flex gap-4 p-4 bg-white border shadow-sm animate-pulse rounded-xl">
			<div className="w-20 h-20 rounded-md bg-neutral-200" />
			<div className="flex-1 space-y-3">
				<div className="w-2/3 h-4 rounded bg-neutral-200" />
				<div className="w-1/3 h-3 rounded bg-neutral-200" />
				<div className="w-40 h-6 rounded bg-neutral-200" />
			</div>
		</li>
	);

	return (
		<div className="max-w-6xl px-4 mx-auto space-y-10 md:py-6">
			<header className="space-y-2">
				<h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tu carrito</h1>
				<p className="text-sm text-neutral-600">Revisa y ajusta los productos antes de confirmar tu pedido.</p>
			</header>

			{error && (
				<div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
					<span>{error}</span>
					<button onClick={load} className="px-3 py-1 text-xs font-medium bg-white border rounded border-red-200 hover:bg-red-100">Reintentar</button>
				</div>
			)}
			{issues.length > 0 && (
				<div role="alert" data-testid="cart-issues" className="px-4 py-3 text-sm border rounded-lg text-amber-800 bg-amber-50 border-amber-200">
					<p className="font-medium">Revisa tu carrito antes de continuar:</p>
					<ul className="pl-5 mt-1 space-y-0.5 list-disc">{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
				</div>
			)}
			{loading && (
				<ul className="space-y-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} />)}</ul>
			)}
			{!loading && !error && items.length === 0 && (
				<div className="p-10 text-center bg-white border shadow-sm rounded-xl">
					<p className="mb-4 text-sm text-neutral-600">Tu carrito está vacío.</p>
					<a href="/products" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full bg-carrot text-nav hover:bg-carrot-dark transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Explorar productos <i className='text-base bx bx-right-arrow-alt' /></a>
				</div>
			)}

			{!loading && effective.length > 0 && (
				<div className="grid gap-10 md:grid-cols-[1fr_340px] items-start">
					{/* Items list */}
					<div className="space-y-4">
						<ul className="space-y-4">
							{effective.map(i => (
								<li key={i.productId} data-testid="cart-row" className={`relative flex gap-4 p-4 bg-white border rounded-xl shadow-sm transition ${updating===i.productId?'opacity-60':''}`}>
									<div className="flex-shrink-0 w-20 h-20 overflow-hidden rounded-md bg-neutral-100">
										{i.imageUrl ? (
											/* eslint-disable-next-line @next/next/no-img-element */
											<img src={i.imageUrl} alt={i.name||'Producto'} className="object-cover w-full h-full" />
										) : (
											<div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">SIN IMAGEN</div>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 space-y-1">
												<a href={`/products/${i.slug || i.productId}`} className="text-sm font-semibold text-neutral-900 hover:text-carrot line-clamp-2">{i.name}</a>
												<div className="text-[11px] text-neutral-500">Unidad: {i.price != null ? formatCurrency(i.price) : '-'}{i.stock != null && <> · {i.stock > 0 ? `${i.stock} disponibles` : 'agotado'}</>}</div>
											</div>
											<button onClick={() => remove(i.productId)} disabled={updating === i.productId} className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded">{updating === i.productId ? '...' : 'Eliminar'}</button>
										</div>
										<div className="flex flex-wrap items-center gap-4 mt-4">
											<div className="flex items-center overflow-hidden border rounded-full border-neutral-300 bg-neutral-50 h-9">
												<button aria-label="Reducir cantidad" onClick={() => changeQty(i.productId, i.qty - 1, i.stock)} disabled={updating === i.productId} className="h-full px-4 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">-</button>
												<input
													type="number"
													min={0}
													max={i.stock}
													aria-label="Cantidad"
													className="h-full text-sm text-center bg-transparent w-14 focus:outline-none"
													value={i.qty}
													onChange={e => changeQty(i.productId, parseInt(e.target.value || '0', 10), i.stock)}
												/>
												<button aria-label="Aumentar cantidad" onClick={() => changeQty(i.productId, i.qty + 1, i.stock)} disabled={updating === i.productId || (i.stock != null && i.qty >= i.stock)} className="h-full px-4 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">+</button>
											</div>
											<div className="ml-auto text-sm font-semibold text-right text-neutral-900" data-testid="line-total">
												{i.lineTotal != null ? formatCurrency(i.lineTotal) : '-'}
											</div>
										</div>
									</div>
								</li>
							))}
						</ul>
					</div>

					{/* Summary */}
					<aside className="sticky p-5 space-y-6 bg-white border shadow-sm rounded-xl h-fit top-24">
						<h2 className="text-sm font-semibold tracking-wide text-neutral-700">Resumen</h2>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between"><span>Artículos</span><span data-testid="cart-count">{totalQty}</span></div>
							<div className="flex justify-between pt-2 font-semibold border-t text-neutral-900"><span>Total</span><span data-testid="cart-total">{formatCurrency(total)}</span></div>
							<p className="text-[11px] text-neutral-500">Precios con IVA incluido.</p>
						</div>
						<div className="text-[11px] text-neutral-500 flex items-start gap-2"><i className='text-base bx bxs-truck text-carrot'/> Envío calculado al confirmar el pedido.</div>
						{blocked ? (
							<span aria-disabled="true" className="w-full inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-neutral-200 text-neutral-500 cursor-not-allowed">Ajusta tu carrito para continuar</span>
						) : (
							<a href="/checkout" className="w-full inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-carrot text-nav hover:bg-carrot-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 transition">Continuar al pedido <i className='text-base bx bx-lock'/></a>
						)}
						<button onClick={emptyCart} disabled={emptying || !items.length} className="w-full text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded">{emptying ? 'Vaciando…' : 'Vaciar carrito'}</button>
						<button onClick={load} disabled={loading} className="w-full text-[11px] text-neutral-500 hover:text-neutral-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 rounded">Actualizar</button>
					</aside>
				</div>
			)}
		</div>
	);
}
