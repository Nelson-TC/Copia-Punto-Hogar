import CheckoutForm from '../../components/CheckoutForm';
import { formatCurrency } from '../../src/lib/format';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface RawItem { productId: string; qty: number }

export default async function CheckoutPage() {
	// Para confirmar un pedido el cliente debe haber iniciado sesión.
	const session = await getSession();
	if (!session) redirect('/login?next=/checkout');

	const raw = cookies().get('cart')?.value;
	let items: RawItem[] = [];
	try { if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed.items)) items = parsed.items; } } catch {}

	if (items.length === 0) {
		return (
			<div className="max-w-3xl mx-auto space-y-8">
				<Header />
				<EmptyState />
			</div>
		);
	}

	const products = await prisma.product.findMany({
		where: { id: { in: items.map(i => i.productId) } },
		select: { id: true, name: true, price: true, slug: true, imageUrl: true, stock: true, active: true }
	});
	const map = new Map(products.map(p => [p.id, p]));
	const issues: string[] = [];
	const enriched = items
		.filter(i => map.has(i.productId))
		.map(i => {
			const p = map.get(i.productId)!;
			const price = Number(p.price);
			const available = p.active ? p.stock : 0;
			if (available < i.qty) {
				issues.push(available === 0 ? `"${p.name}" está agotado.` : `De "${p.name}" solo hay ${available} unidad${available === 1 ? '' : 'es'} disponible${available === 1 ? '' : 's'}.`);
			}
			return { ...i, name: p.name, slug: p.slug, imageUrl: p.imageUrl as string | null, price, lineTotal: price * i.qty };
		});
	// Los precios incluyen IVA: el total mostrado es exactamente el que se registra en el pedido.
	const total = enriched.reduce((s, i) => s + i.lineTotal, 0);

	return (
		<div className="max-w-6xl mx-auto space-y-10">
			<Header hasItems />
			<div className="grid gap-10 lg:grid-cols-3">
				{/* Columna izquierda: Formulario */}
				<div className="space-y-6 lg:col-span-2">
					<ProgressSteps current={1} />
					{issues.length > 0 && (
						<div role="alert" data-testid="checkout-issues" className="px-4 py-3 text-sm border rounded-lg text-amber-800 bg-amber-50 border-amber-200">
							<p className="font-medium">Hay productos con problemas de existencias:</p>
							<ul className="pl-5 mt-1 space-y-0.5 list-disc">{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
							<Link href="/cart" className="inline-block mt-2 text-xs font-semibold underline">Volver al carrito para ajustarlo</Link>
						</div>
					)}
					<CheckoutForm total={total} blocked={issues.length > 0} />
					<SecurityNote />
				</div>
				{/* Columna derecha: Resumen */}
				<aside className="space-y-6 lg:sticky lg:top-24 h-max">
					<SummaryCard enriched={enriched} total={total} />
					<MiniPolicy />
				</aside>
			</div>
		</div>
	);
}

function Header({ hasItems }: { hasItems?: boolean }) {
	return (
		<header className="space-y-2">
			<h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
			<p className="text-sm text-neutral-600">
				{hasItems ? 'Ingresa tus datos de envío para confirmar tu pedido.' : 'Tu carrito está vacío.'}
			</p>
		</header>
	);
}

function EmptyState() {
	return (
		<div className="p-10 space-y-4 text-center border rounded-lg shadow-sm bg-surface">
			<p className="text-sm text-neutral-600">No hay productos para procesar.</p>
			<div className="flex justify-center gap-3">
				<Link href="/products" className="px-4 py-2 text-sm font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Ver productos</Link>
				<Link href="/" className="px-4 py-2 text-sm font-medium bg-white border rounded border-neutral-300 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot">Inicio</Link>
			</div>
		</div>
	);
}

function ProgressSteps({ current }: { current: number }) {
	const steps = [
		{ id: 1, label: 'Datos' },
		{ id: 2, label: 'Confirmación' }
	];
	return (
		<ol className="flex items-center gap-4 text-xs" aria-label="Progreso de compra">
			{steps.map((s, i) => {
				const active = s.id === current;
				const completed = s.id < current;
				return (
					<li key={s.id} className="flex items-center gap-2">
						<span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium ${active ? 'bg-carrot border-carrot text-nav' : completed ? 'bg-nav text-white border-nav' : 'border-neutral-300 text-neutral-500'}`}>{s.id}</span>
						<span className={`font-medium ${active ? 'text-neutral-900' : 'text-neutral-500'}`}>{s.label}</span>
						{i < steps.length - 1 && <span className="block w-8 h-px bg-neutral-300" aria-hidden="true" />}
					</li>
				);
			})}
		</ol>
	);
}

interface EnrichedItem { productId: string; name: string; slug: string; imageUrl: string | null; price: number; qty: number; lineTotal: number }

function SummaryCard({ enriched, total }: { enriched: EnrichedItem[]; total: number }) {
	return (
		<div className="p-5 space-y-5 border rounded-lg shadow-sm bg-surface">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">Resumen</h2>
				<Link href="/cart" className="text-[11px] font-medium text-carrot hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav rounded">Editar carrito</Link>
			</div>
			<ul className="divide-y">
				{enriched.map(item => (
					<li key={item.productId} className="flex gap-3 py-3">
						<div className="relative flex-shrink-0 overflow-hidden border rounded h-14 w-14 bg-neutral-100">
							{item.imageUrl ? (
								<Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" />
							) : (
								<div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">IMG</div>
							)}
						</div>
						<div className="flex-1 min-w-0">
							<Link href={`/products/${item.slug}`} className="block text-sm font-medium rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot line-clamp-2">{item.name}</Link>
							<p className="text-[11px] text-neutral-500">Qty: {item.qty} · {formatCurrency(item.price)}</p>
						</div>
						<div className="text-sm font-medium tabular-nums">{formatCurrency(item.lineTotal)}</div>
					</li>
				))}
			</ul>
			<div className="space-y-2 text-sm">
				<div className="flex justify-between pt-2 font-semibold border-t"><span>Total</span><span className="tabular-nums" data-testid="checkout-total">{formatCurrency(total)}</span></div>
			</div>
			<p className="text-[11px] text-neutral-500 leading-relaxed">
				Precios con IVA incluido. Las existencias se verifican al confirmar el pedido.
			</p>
		</div>
	);
}

function SecurityNote() {
	return (
		<div className="flex items-start gap-3 p-4 border rounded-lg shadow-sm bg-surface">
			<svg className="w-5 h-5 text-carrot" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M10 13a2 2 0 0 0 4 0v-2a2 2 0 0 0-4 0"/></svg>
			<p className="text-xs leading-relaxed text-neutral-600">Tus datos se usan solo para procesar el pedido. No compartimos información personal con terceros.</p>
		</div>
	);
}

function MiniPolicy() {
	return (
		<div className="rounded-lg border bg-surface p-4 shadow-sm text-[11px] text-neutral-600 space-y-2">
			<p><strong className="font-semibold">Política rápida:</strong></p>
			<ul className="pl-4 space-y-1 list-disc">
				<li>Revisa cantidades antes de confirmar.</li>
				<li>Soporte: <a href="/contact" className="text-carrot hover:underline">Contacto</a>.</li>
				<li>Envíos en 24-48h laborables.</li>
			</ul>
		</div>
	);
}
