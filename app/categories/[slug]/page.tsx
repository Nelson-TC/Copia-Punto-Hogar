import { notFound } from 'next/navigation';
import { prisma } from '../../../src/lib/prisma';
import ProductCard from '../../../components/ProductCard';
import Link from 'next/link';
import { plainProduct } from '../../../src/lib/serialize';

export const dynamic = 'force-dynamic';

interface Props { params: { slug: string }, searchParams: { page?: string; per?: string } }

const DEFAULT_PER = 12; const MAX_PER = 48;

function parsePagination(searchParams: Props['searchParams']) {
	const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
	let per = parseInt(searchParams.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
	per = Math.min(Math.max(4, per), MAX_PER);
	return { page, per };
}

async function getCategoryWithProducts(slug: string, page: number, per: number) {
	const category = await prisma.category.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, active: true } });
	if (!category || !category.active) return null;
	// Cada categoría muestra únicamente productos activos.
	const total = await prisma.product.count({ where: { category: { slug }, active: true } });
	const totalPages = Math.max(1, Math.ceil(total / per));
	const safePage = Math.min(page, totalPages);
	const skip = (safePage - 1) * per;
	const products = await prisma.product.findMany({
		where: { category: { slug }, active: true },
		skip,
		take: per,
		include: { category: { select: { name: true } } },
		orderBy: { createdAt: 'desc' }
	});
	return { category, products: products.map(plainProduct), total, totalPages, page: safePage, per };
}

function buildLink(base: string, page: number, per: number) {
	const params = new URLSearchParams();
	if (page > 1) params.set('page', String(page));
	if (per !== DEFAULT_PER) params.set('per', String(per));
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}

export default async function CategoryPage({ params, searchParams }: Props) {
	const { page, per } = parsePagination(searchParams);
	const data = await getCategoryWithProducts(params.slug, page, per);
	if (!data) return notFound();
	const { category, products, total, totalPages, page: currentPage } = data;
	const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
	const end = Math.min(total, currentPage * per);

	return (
		<div className="space-y-10">
			<header className="space-y-3">
				<h1 className="text-4xl font-extrabold">{category.name}</h1>
				<div className="text-sm text-neutral-600">{total === 0 ? 'Sin productos.' : `Mostrando ${start}–${end} de ${total}`}</div>
			</header>

			<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
				{products.map((p: any) => <ProductCard key={p.id} product={p} />)}
				{products.length === 0 && <p className="text-sm col-span-full text-neutral-600">Sin productos.</p>}
			</div>

			{totalPages > 1 && (
				<nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-2 pt-4">
					<Pagination current={currentPage} totalPages={totalPages} per={per} base={`/categories/${category.slug}`} />
				</nav>
			)}

			<div className="pt-2 text-center">
				<span className="text-[11px] text-neutral-500">Items por página: </span>
				{[12, 24, 36, 48].map(n => (
					<Link key={n} href={buildLink(`/categories/${category.slug}`, 1, n)} className={`inline-block px-3 py-1 text-[11px] rounded-full border transition ml-1 ${n===per?'bg-carrot text-nav border-carrot':'border-neutral-300 hover:bg-neutral-100'}`}>{n}</Link>
				))}
			</div>
		</div>
	);
}

interface PaginationProps { current: number; totalPages: number; per: number; base: string }
function Pagination({ current, totalPages, per, base }: PaginationProps) {
	const window = 2;
	const first = 1; const last = totalPages;
	const pages: number[] = [];
	for (let p = Math.max(first, current - window); p <= Math.min(last, current + window); p++) pages.push(p);
	if (!pages.includes(first)) pages.unshift(first);
	if (!pages.includes(last)) pages.push(last);
	const unique = Array.from(new Set(pages)).sort((a,b)=>a-b);
	const items: (number|'gap')[] = [];
	unique.forEach((p,i)=>{ if(i>0 && p - unique[i-1] > 1) items.push('gap'); items.push(p); });

	function link(page: number) {
		const params = new URLSearchParams();
		if (page > 1) params.set('page', String(page));
		if (per !== DEFAULT_PER) params.set('per', String(per));
		const qs = params.toString();
		return qs ? `${base}?${qs}` : base;
	}

	return (
		<div className="flex flex-wrap items-center gap-1">
			<Link href={link(Math.max(1, current - 1))} aria-disabled={current===1} aria-label="Anterior" className={`px-3 py-1.5 text-xs rounded-full border transition ${current===1?'border-neutral-200 text-neutral-400 cursor-not-allowed':'border-neutral-300 hover:bg-neutral-100'}`}>«</Link>
			{items.map((it,idx)=> it==='gap'? <span key={idx} className="px-2 text-xs select-none text-neutral-400">…</span> : (
				<Link key={it} href={link(it)} aria-current={it===current?'page':undefined} className={`px-3 py-1.5 text-xs rounded-full border transition ${it===current?'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{it}</Link>
			))}
			<Link href={link(Math.min(totalPages, current + 1))} aria-disabled={current===totalPages} aria-label="Siguiente" className={`px-3 py-1.5 text-xs rounded-full border transition ${current===totalPages?'border-neutral-200 text-neutral-400 cursor-not-allowed':'border-neutral-300 hover:bg-neutral-100'}`}>»</Link>
		</div>
	);
}
