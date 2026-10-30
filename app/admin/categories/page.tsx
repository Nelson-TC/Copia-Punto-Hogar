import Link from 'next/link';
import { prisma } from '../../../src/lib/prisma';
import { getSession } from '../../../src/lib/auth';
import { getUserPermissions } from '../../../src/lib/permissions';
import AdminCategoryRowActions from '../../../components/AdminCategoryRowActions';

interface SearchParams { page?: string; per?: string }

const DEFAULT_PER = 20; const MAX_PER = 100;

function parsePagination(sp: SearchParams) {
  const page = Math.max(parseInt(sp.page || '1', 10) || 1, 1);
  let per = parseInt(sp.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
  per = Math.min(Math.max(5, per), MAX_PER);
  return { page, per };
}

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
	const session = await getSession();
	let canCreate = false; let canUpdate = false; let canDelete = false;
	if (session) {
		const perms = await getUserPermissions(session.sub);
		canCreate = perms.has('admin:access') || perms.has('category:create');
		canUpdate = perms.has('admin:access') || perms.has('category:update');
		canDelete = perms.has('admin:access') || perms.has('category:delete');
	}
  const { page, per } = parsePagination(searchParams);
  const total = await prisma.category.count();
  const totalPages = Math.max(1, Math.ceil(total / per));
  const currentPage = Math.min(page, totalPages);
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (currentPage - 1) * per,
    take: per,
    include: { _count: { select: { products: true } } }
  });
  const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
  const end = Math.min(total, currentPage * per);
	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
					<p className="text-sm text-neutral-600">Gestiona la estructura del catálogo. {total>0 && <span className="text-neutral-500">Mostrando {start}-{end} de {total}</span>}</p>
				</div>
				<div className="flex items-center gap-3">
					{canCreate && <Link href="/admin/categories/new" className="px-4 py-2 text-sm font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Nueva</Link>}
				</div>
			</header>
			<div className="overflow-auto border rounded-lg shadow-sm bg-surface">
				<table className="w-full text-sm text-left align-middle">
					<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
						<tr>
							<th className="px-3 py-2 font-medium">Nombre</th>
							<th className="px-3 py-2 font-medium">Activa</th>
							<th className="px-3 py-2 font-medium">Productos</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{categories.map((c: any) => (
							<tr key={c.id} className="hover:bg-neutral-50">
								<td className="px-3 py-2 font-medium text-neutral-800">{c.name}</td>
								<td className="px-3 py-2"><span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${c.active? 'bg-green-100 text-green-700':'bg-neutral-200 text-neutral-600'}`}>{c.active? 'Sí':'No'}</span></td>
								<td className="px-3 py-2 text-xs text-neutral-600 whitespace-nowrap">{c._count?.products ?? 0}</td>
								<td className="px-3 py-2 text-right">
									<AdminCategoryRowActions id={c.id} name={c.name} canUpdate={canUpdate} canDelete={canDelete} />
								</td>
							</tr>
						))}
						{categories.length === 0 && (
							<tr><td colSpan={4} className="px-4 py-8 text-sm text-center text-neutral-500">Sin categorías</td></tr>
						)}
					</tbody>
				</table>
			</div>
				{totalPages > 1 && <Pagination base="/admin/categories" current={currentPage} totalPages={totalPages} per={per} />}
				<PerPageSelector base="/admin/categories" per={per} />
		</div>
	);
}

	interface PaginationProps { base: string; current: number; totalPages: number; per: number }
	function Pagination({ base, current, totalPages, per }: PaginationProps) {
		function link(p: number) {
			const params = new URLSearchParams();
			if (p > 1) params.set('page', String(p));
			if (per !== DEFAULT_PER) params.set('per', String(per));
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

	function PerPageSelector({ base, per }: { base: string; per: number }) {
		const options = [10,20,50,100];
		return (
			<div className="text-[11px] text-neutral-500 flex items-center gap-1 pt-2 flex-wrap">Filas por página:
				{options.map(o => {
					const params = new URLSearchParams();
					if (o !== DEFAULT_PER) params.set('per', String(o));
					const href = `${base}?${params.toString()}`.replace(/\?$/, '');
					return <a key={o} href={href} className={`px-2 py-1 rounded border ${o===per? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{o}</a>;
				})}
			</div>
		);
	}
