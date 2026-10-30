import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { getUserPermissions } from '@/lib/permissions';
import { formatCurrency } from '@/lib/format';

interface SearchParams { page?: string; q?: string; status?: string }

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
	// Autorización por permiso
	const current = await getCurrentUser();
	if (!current) return <p className="text-sm text-red-600">No autenticado.</p>;
	const perms = await getUserPermissions(current.id);
	if (!(perms.has('admin:access') || perms.has('order:read'))) {
		return <p className="text-sm text-red-600">No autorizado.</p>;
	}

	const pageSize = 20; // TODO: permitir per-page configurable similar a otras secciones
	const page = Math.max(parseInt(searchParams.page || '1', 10) || 1, 1);
	const q = (searchParams.q || '').trim();
	// Filtro de estado (por defecto PENDING)
	const rawStatus = (searchParams.status || 'PENDING').toUpperCase();
	const allowedStatuses = ['PENDING','PAID','SHIPPED','COMPLETED','CANCELED'] as const;
	const status = allowedStatuses.includes(rawStatus as any) ? rawStatus : 'PENDING';
	const where: any = {
		...(q ? {
			OR: [
				{ id: { contains: q } },
				{ customer: { contains: q, mode: 'insensitive' } },
				{ email: { contains: q, mode: 'insensitive' } }
			]
		} : {}),
		status
	};

	const [totalCount, orders] = await Promise.all([
		prisma.order.count({ where }),
		prisma.order.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				customer: true,
				email: true,
				subtotal: true,
				total: true,
				createdAt: true,
				items: { select: { id: true } }
			}
		})
	]);

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	const statusLabels: Record<string,string> = {
		PENDING: 'Pendiente',
		PAID: 'Pagado',
		SHIPPED: 'Enviado',
		COMPLETED: 'Completado',
		CANCELED: 'Cancelado'
	};

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
					<p className="text-sm text-neutral-600">Historial y búsqueda de pedidos por estado.</p>
				</div>
				<form className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search" aria-label="Buscar pedidos">
					<div className="flex w-full gap-2">
						<input
							name="q"
							defaultValue={q}
							placeholder="Buscar id, cliente o email..."
							className="w-full px-3 py-2 text-sm bg-white border rounded-md sm:w-72 border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50"
						/>
						<select
							name="status"
							defaultValue={status}
							className="px-3 py-2 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50"
							aria-label="Filtrar por estado"
						>
							{allowedStatuses.map(s => (
								<option key={s} value={s}>{statusLabels[s]}</option>
							))}
						</select>
					</div>
					<div className="flex gap-2">
						<button className="px-4 py-2 text-sm font-semibold rounded-md bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Aplicar</button>
						{(q || status !== 'PENDING') && (
							<Link
								href="/admin/orders"
								className="px-4 py-2 text-sm font-medium transition border rounded-md bg-white/70 border-neutral-300 text-neutral-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50"
								aria-label="Limpiar filtros"
							>
								Limpiar
							</Link>
						)}
					</div>
				</form>
			</header>

			<div className="text-xs text-neutral-500">Mostrando página {page} de {totalPages} — estado: {statusLabels[status]}{q && <> — búsqueda: &quot;{q}&quot;</>}.</div>

			{orders.length === 0 && (
				<p className="text-sm text-neutral-600">No hay pedidos {q && <>para la búsqueda &quot;{q}&quot;</>}.</p>
			)}

			{/* Mobile cards */}
			{orders.length > 0 && (
				<ul className="grid gap-4 md:hidden" aria-label="Listado de pedidos (vista móvil)">
					{orders.map(o => {
						const itemsCount = o.items.length;
						return (
							<li key={o.id} className="relative p-4 transition border rounded-lg shadow-sm bg-white/80 backdrop-blur-sm border-neutral-200 hover:border-carrot/40 hover:shadow-md">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 space-y-1">
										<p className="font-mono text-[11px] text-neutral-500 truncate" title={o.id}>#{o.id}</p>
										<p className="text-sm font-semibold leading-tight truncate text-neutral-800">{o.customer}</p>
										<p className="text-[11px] text-neutral-500 truncate">{o.email}</p>
									</div>
									<Link href={`/admin/orders/${o.id}`} className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-xs font-medium rounded-md bg-carrot/90 text-nav hover:bg-carrot focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50">Ver</Link>
								</div>
								<div className="flex flex-wrap mt-3 text-[11px] gap-x-4 gap-y-1 text-neutral-600">
									<span>Items: <strong className="font-semibold text-neutral-800">{itemsCount}</strong></span>
									<span>Subtotal: <strong className="font-semibold">{formatCurrency(Number(o.subtotal))}</strong></span>
									<span>Total: <strong className="font-semibold text-carrot-dark">{formatCurrency(Number(o.total))}</strong></span>
									<span>{o.createdAt.toISOString().slice(0,10)}</span>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{/* Desktop table */}
			{orders.length > 0 && (
				<div className="hidden overflow-auto border rounded-lg shadow-sm bg-surface md:block">
					<table className="w-full text-sm text-left align-middle min-w-[760px]">
						<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
							<tr>
								<th className="px-3 py-2 font-medium">ID</th>
								<th className="px-3 py-2 font-medium">Cliente</th>
								<th className="px-3 py-2 font-medium">Email</th>
								<th className="px-3 py-2 font-medium text-right">Items</th>
								<th className="px-3 py-2 font-medium text-right">Subtotal</th>
								<th className="px-3 py-2 font-medium text-right">Total</th>
								<th className="px-3 py-2 font-medium">Fecha</th>
								<th className="px-3 py-2" />
							</tr>
						</thead>
						<tbody className="divide-y">
							{orders.map(o => {
								const itemsCount = o.items.length;
								return (
									<tr key={o.id} className="hover:bg-neutral-50">
										<td className="px-3 py-2 font-mono text-xs truncate max-w-[140px]" title={o.id}>{o.id}</td>
										<td className="px-3 py-2 font-medium text-neutral-800">{o.customer}</td>
										<td className="px-3 py-2 text-neutral-600">{o.email}</td>
										<td className="px-3 py-2 text-right">{itemsCount}</td>
										<td className="px-3 py-2 text-right">{formatCurrency(Number(o.subtotal))}</td>
										<td className="px-3 py-2 font-semibold text-right">{formatCurrency(Number(o.total))}</td>
										<td className="px-3 py-2 text-xs whitespace-nowrap">{o.createdAt.toISOString().slice(0,16).replace('T',' ')}</td>
										<td className="px-3 py-2 text-right"><Link href={`/admin/orders/${o.id}`} className="text-xs font-medium text-carrot hover:underline">Ver</Link></td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{totalPages > 1 && (
				<nav className="flex flex-wrap items-center gap-2 pt-2 text-xs" aria-label="Paginación de pedidos">
					{Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
						const active = p === page;
						const params = new URLSearchParams();
						if (q) params.set('q', q);
						if (status !== 'PENDING') params.set('status', status);
						if (p !== 1) params.set('page', String(p));
						const href = params.toString() ? `?${params.toString()}` : '';
						return (
							<Link
								key={p}
								href={href}
								aria-current={active ? 'page': undefined}
								className={`px-3 py-1 rounded border transition ${active ? 'bg-carrot text-nav border-carrot font-semibold' : 'border-neutral-300 hover:bg-neutral-100'}`}
							>{p}</Link>
						);
					})}
				</nav>
			)}
		</div>
	);
}
