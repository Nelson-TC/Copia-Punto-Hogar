import Link from 'next/link';
import { prisma } from '../../../src/lib/prisma';
import { getSession } from '../../../src/lib/auth';
import { getUserPermissions } from '../../../src/lib/permissions';
import AdminProductRowActions from '../../../components/AdminProductRowActions';
import { marginPct, profitPerUnit } from '../../../src/lib/pricing';

export const dynamic = 'force-dynamic';

interface SearchParams { page?: string; per?: string; q?: string; active?: string; stock?: string }
const DEFAULT_PER = 20; const MAX_PER = 100;
const LOW_STOCK = 5; // desde esta cantidad hacia abajo se marca como "stock bajo"
function parsePagination(sp: SearchParams) {
	const page = Math.max(parseInt(sp.page || '1', 10) || 1, 1);
	let per = parseInt(sp.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
	per = Math.min(Math.max(5, per), MAX_PER);
	return { page, per };
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
	// Permissions server-side to conditionally render buttons/links
	const session = await getSession();
	let canCreate = false; let canUpdate = false; let canDelete = false;
	if (session) {
		const perms = await getUserPermissions(session.sub);
		canCreate = perms.has('admin:access') || perms.has('product:create');
		canUpdate = perms.has('admin:access') || perms.has('product:update');
		canDelete = perms.has('admin:access') || perms.has('product:delete');
	}
	const { page, per } = parsePagination(searchParams);
	const q = (searchParams.q || '').trim();
	const activeParam = (searchParams.active || 'all').trim(); // 'true' | 'false' | 'all'
	const stockParam = (searchParams.stock || 'all').trim(); // 'all' | 'out' | 'low'
	const where: any = {};
	if (activeParam && activeParam !== 'all') where.active = activeParam === 'true';
	if (stockParam === 'out') where.stock = 0;
	else if (stockParam === 'low') where.stock = { gt: 0, lte: LOW_STOCK };
	if (q) {
		where.AND = (where.AND || []).concat([
			{ OR: [
				{ name: { contains: q, mode: 'insensitive' } },
				{ description: { contains: q, mode: 'insensitive' } }
			]}
		]);
	}
	const total = await prisma.product.count({ where });
	const totalPages = Math.max(1, Math.ceil(total / per));
	const currentPage = Math.min(page, totalPages);
	const products = await prisma.product.findMany({
		where,
		include: { category: true },
		orderBy: { createdAt: 'desc' },
		skip: (currentPage - 1) * per,
		take: per
	});
	const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
	const end = Math.min(total, currentPage * per);
	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Productos</h1>
					<p className="text-sm text-neutral-600">Gestiona los items disponibles en la tienda. {total>0 && <span className="text-neutral-500">Mostrando {start}-{end} de {total}</span>}</p>
				</div>
				{canCreate && <Link href="/admin/products/new" className="px-4 py-2 text-sm font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Nuevo</Link>}
			</header>
			{/* Toolbar de filtros */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<form action="/admin/products" method="get" className="flex flex-1 items-center gap-2">
					<input
						type="text"
						name="q"
						defaultValue={q}
						placeholder="Buscar productos..."
						className="flex-1 px-4 py-2 rounded-md border border-neutral-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
					/>
					<select
						name="active"
						defaultValue={['true','false','all'].includes(activeParam)? activeParam : 'all'}
						className="px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm"
						aria-label="Estado"
					>
						<option value="all">Todos</option>
						<option value="true">Activos</option>
						<option value="false">Inactivos</option>
					</select>
					<select
						name="stock"
						defaultValue={['all','out','low'].includes(stockParam)? stockParam : 'all'}
						className="px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm"
						aria-label="Inventario"
					>
						<option value="all">Todo el inventario</option>
						<option value="low">Stock bajo (1-{LOW_STOCK})</option>
						<option value="out">Agotados</option>
					</select>
					<button type="submit" className="px-4 py-2 text-sm font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark">Aplicar</button>
				</form>
			</div>
			<div className="overflow-auto border rounded-lg shadow-sm bg-surface">
				<table className="w-full text-sm text-left align-middle">
					<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
						<tr>
							<th className="px-3 py-2 font-medium">Nombre</th>
							<th className="px-3 py-2 font-medium">Categoría</th>
							<th className="px-3 py-2 font-medium">Precio</th>
							<th className="px-3 py-2 font-medium">Costo</th>
							<th className="px-3 py-2 font-medium">Margen</th>
							<th className="px-3 py-2 font-medium">Stock</th>
							<th className="px-3 py-2 font-medium">Estado</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{products.map((p: any) => (
							<tr key={p.id} className="hover:bg-neutral-50 align-top">
								<td className="px-3 py-2 font-medium text-neutral-800 max-w-[260px] truncate" title={p.name}>{p.name}</td>
								<td className="px-3 py-2 text-neutral-600">{p.category?.name}</td>
								<td className="px-3 py-2 font-mono text-xs text-neutral-700">Q{Number(p.price).toFixed(2)}</td>
								<td className="px-3 py-2 font-mono text-xs text-neutral-700">{Number(p.costPrice) > 0 ? `Q${Number(p.costPrice).toFixed(2)}` : <span className="text-amber-600">Sin costo</span>}</td>
								<td className="px-3 py-2 text-xs whitespace-nowrap">
									{Number(p.costPrice) > 0 ? (() => {
										const margin = marginPct(Number(p.price), Number(p.costPrice));
										const profit = profitPerUnit(Number(p.price), Number(p.costPrice));
										return <span className={`font-semibold ${profit < 0 ? 'text-red-600' : 'text-green-700'}`} title={`Ganancia por unidad: Q${profit.toFixed(2)}`}>{margin}%</span>;
									})() : <span className="text-neutral-400">—</span>}
								</td>
								<td className="px-3 py-2 whitespace-nowrap">
									<span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= LOW_STOCK ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
										{p.stock === 0 ? 'Agotado' : p.stock <= LOW_STOCK ? `Bajo · ${p.stock}` : p.stock}
									</span>
								</td>
								<td className="px-3 py-2"><span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'}`}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
								<td className="px-3 py-2 text-right">
									<AdminProductRowActions id={p.id} name={p.name} stock={p.stock} canUpdate={canUpdate} canDelete={canDelete} />
								</td>
							</tr>
						))}
						{products.length === 0 && (
							<tr><td colSpan={8} className="px-4 py-8 text-sm text-center text-neutral-500">Sin productos</td></tr>
						)}
					</tbody>
				</table>
			</div>
			{totalPages > 1 && <Pagination base="/admin/products" current={currentPage} totalPages={totalPages} per={per} q={q} active={activeParam} stock={stockParam} />}
			<PerPageSelector base="/admin/products" per={per} q={q} active={activeParam} stock={stockParam} />
		</div>
	);
}

interface PaginationProps { base: string; current: number; totalPages: number; per: number; q?: string; active?: string; stock?: string }
function Pagination({ base, current, totalPages, per, q, active, stock }: PaginationProps) {
	function link(p: number) {
		const params = new URLSearchParams();
		if (p > 1) params.set('page', String(p));
		if (per !== DEFAULT_PER) params.set('per', String(per));
		if (q) params.set('q', q);
		if (active && active !== 'all') params.set('active', active);
		if (stock && stock !== 'all') params.set('stock', stock);
		const qs = params.toString(); return qs ? `${base}?${qs}` : base;
	}
	const window = 2; const pages: number[] = [];
	for (let i = Math.max(1, current - window); i <= Math.min(totalPages, current + window); i++) pages.push(i);
	if (!pages.includes(1)) pages.unshift(1);
	if (!pages.includes(totalPages)) pages.push(totalPages);
	const seq: (number|'gap')[] = []; pages.sort((a,b)=>a-b).forEach((p,i,arr)=>{ if(i>0 && p - arr[i-1] > 1) seq.push('gap'); seq.push(p); });
	return (
		<nav aria-label="Paginación" className="flex flex-wrap items-center gap-1 pt-2 text-xs">
			<a aria-disabled={current===1} className={`px-3 py-1 rounded border ${current===1?'cursor-not-allowed text-neutral-400 border-neutral-200':'border-neutral-300 hover:bg-neutral-100'}`} href={current===1? undefined: link(current-1)}>«</a>
			{seq.map((it,i)=> it==='gap'? <span key={i} className="px-2">…</span> : (
				<a key={it} href={link(it)} aria-current={it===current?'page':undefined} className={`px-3 py-1 rounded border ${it===current? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{it}</a>
			))}
			<a aria-disabled={current===totalPages} className={`px-3 py-1 rounded border ${current===totalPages?'cursor-not-allowed text-neutral-400 border-neutral-200':'border-neutral-300 hover:bg-neutral-100'}`} href={current===totalPages? undefined: link(current+1)}>»</a>
		</nav>
	);
}

function PerPageSelector({ base, per, q, active, stock }: { base: string; per: number; q?: string; active?: string; stock?: string }) {
	const options = [10,20,50,100];
	return (
		<div className="text-[11px] text-neutral-500 flex items-center gap-1 pt-2 flex-wrap">Filas por página:
			{options.map(o => {
				const params = new URLSearchParams();
				if (o !== DEFAULT_PER) params.set('per', String(o));
				if (q) params.set('q', q);
				if (active && active !== 'all') params.set('active', active);
				if (stock && stock !== 'all') params.set('stock', stock);
				const href = `${base}?${params.toString()}`.replace(/\?$/, '');
				return <a key={o} href={href} className={`px-2 py-1 rounded border ${o===per? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{o}</a>;
			})}
		</div>
	);
}
