import Link from 'next/link';
import { prisma } from '../../../src/lib/prisma';
import { getSession } from '../../../src/lib/auth';
import { getUserPermissions } from '../../../src/lib/permissions';
import AdminUserRowActions from '../../../components/AdminUserRowActions';

export const dynamic = 'force-dynamic';

interface SearchParams { page?: string; per?: string }
const DEFAULT_PER = 20; const MAX_PER = 100;
function parsePagination(sp: SearchParams) {
	const page = Math.max(parseInt(sp.page || '1', 10) || 1, 1);
	let per = parseInt(sp.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
	per = Math.min(Math.max(5, per), MAX_PER);
	return { page, per };
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
	const session = await getSession();
	let canCreate = false; let canUpdate = false; let canDelete = false;
	if (session) {
		const perms = await getUserPermissions(session.sub);
		canCreate = perms.has('admin:access') || perms.has('user:create');
		canUpdate = perms.has('admin:access') || perms.has('user:update');
		canDelete = perms.has('admin:access') || perms.has('user:delete');
	}
	const { page, per } = parsePagination(searchParams);
	const total = await prisma.user.count();
	const totalPages = Math.max(1, Math.ceil(total / per));
	const currentPage = Math.min(page, totalPages);
	const users = await prisma.user.findMany({
		orderBy: { createdAt: 'desc' },
		skip: (currentPage - 1) * per,
		take: per,
		include: { userRoles: { include: { role: { select: { label: true, name: true } } } } }
	});
	const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
	const end = Math.min(total, currentPage * per);
	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
					<p className="text-sm text-neutral-600">Administración básica de cuentas. {total>0 && <span className="text-neutral-500">Mostrando {start}-{end} de {total}</span>}</p>
				</div>
				{canCreate && <Link href="/admin/users/new" className="px-4 py-2 text-sm font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav">Nuevo</Link>}
			</header>
			<div className="overflow-auto border rounded-lg shadow-sm bg-surface">
				<table className="w-full text-sm text-left align-middle">
					<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
						<tr>
							<th className="px-3 py-2 font-medium">Email</th>
							<th className="px-3 py-2 font-medium">Nombre</th>
							<th className="px-3 py-2 font-medium">Roles</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{users.map((u: any) => (
							<tr key={u.id} className="hover:bg-neutral-50">
								<td className="px-3 py-2 font-medium text-neutral-800 max-w-[240px] truncate" title={u.email}>{u.email}</td>
								<td className="px-3 py-2 text-neutral-600">{u.name}</td>
								<td className="px-3 py-2 text-xs whitespace-nowrap">{u.userRoles.length === 0 ? <span className="text-neutral-400">Cliente</span> : u.userRoles.map((r: any) => <span key={r.roleId} className="inline-block px-2 py-0.5 mr-1 text-[11px] font-medium rounded-full bg-nav/10 text-nav">{r.role.label || r.role.name}</span>)}</td>
								<td className="px-3 py-2 text-right"><AdminUserRowActions id={u.id} email={u.email} isSelf={u.id === session?.sub} canUpdate={canUpdate} canDelete={canDelete} /></td>
							</tr>
						))}
						{users.length === 0 && (
							<tr><td colSpan={4} className="px-4 py-8 text-sm text-center text-neutral-500">Sin usuarios</td></tr>
						)}
					</tbody>
				</table>
			</div>
			{totalPages > 1 && <Pagination base="/admin/users" current={currentPage} totalPages={totalPages} per={per} />}
			<PerPageSelector base="/admin/users" per={per} />
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
