import { prisma } from '../../src/lib/prisma';
import ProductCard from '../../components/ProductCard';
import SearchToolbar from '../../components/SearchToolbar';
import { plainProduct } from '../../src/lib/serialize';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
	searchParams: { page?: string; per?: string; q?: string; sort?: string; cat?: string; priceMin?: string; priceMax?: string }
}

const DEFAULT_PER = 12;
const MAX_PER = 48;

function parsePagination(searchParams: ProductsPageProps['searchParams']) {
	const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
	let per = parseInt(searchParams.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
	per = Math.min(Math.max(4, per), MAX_PER);
	return { page, per };
}

// Catálogo del cliente: solo productos activos, con búsqueda, filtros por categoría y precio, y ordenamiento.
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
	const { page, per } = parsePagination(searchParams);
	const q = (searchParams.q || '').trim();
	const sort = (searchParams.sort || 'new').toLowerCase();
	const cat = (searchParams.cat || '').trim();
	const priceMin = parseFloat(searchParams.priceMin || '');
	const priceMax = parseFloat(searchParams.priceMax || '');
	const hasMin = !Number.isNaN(priceMin);
	const hasMax = !Number.isNaN(priceMax);

	const [categories, bounds] = await Promise.all([
		prisma.category.findMany({ where: { active: true }, select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
		prisma.product.aggregate({ where: { active: true }, _min: { price: true }, _max: { price: true } })
	]);
	const minBound = bounds._min.price ? Math.floor(Number(bounds._min.price)) : 0;
	const maxBound = bounds._max.price ? Math.ceil(Number(bounds._max.price)) : 0;

	const where: any = { active: true };
	if (q.length >= 2) {
		where.OR = [
			{ name: { contains: q, mode: 'insensitive' } },
			{ description: { contains: q, mode: 'insensitive' } }
		];
	}
	if (cat) {
		const found = categories.find(c => c.slug === cat || c.id === cat);
		where.categoryId = found ? found.id : '__none__';
	}
	if (hasMin || hasMax) {
		where.price = {};
		if (hasMin) where.price.gte = priceMin;
		if (hasMax) where.price.lte = priceMax;
	}
	let orderBy: any = { createdAt: 'desc' };
	if (sort === 'price_asc') orderBy = { price: 'asc' };
	else if (sort === 'price_desc') orderBy = { price: 'desc' };
	else if (sort === 'name') orderBy = { name: 'asc' };

	const total = await prisma.product.count({ where });
	const totalPages = Math.max(1, Math.ceil(total / per));
	const currentPage = Math.min(page, totalPages);
	const rows = await prisma.product.findMany({
		where,
		skip: (currentPage - 1) * per,
		take: per,
		include: { category: { select: { name: true } } },
		orderBy
	});
	const products = rows.map(plainProduct);
	const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
	const end = Math.min(total, currentPage * per);

	function link(p: number) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (sort !== 'new') params.set('sort', sort);
		if (cat) params.set('cat', cat);
		if (hasMin) params.set('priceMin', String(priceMin));
		if (hasMax) params.set('priceMax', String(priceMax));
		if (per !== DEFAULT_PER) params.set('per', String(per));
		if (p > 1) params.set('page', String(p));
		const qs = params.toString();
		return qs ? `/products?${qs}` : '/products';
	}

	return (
		<div className="space-y-8">
			<header className="space-y-4">
				<div className="space-y-2">
					<h1 className="text-4xl font-extrabold">Productos</h1>
					<div className="text-sm text-neutral-600" data-testid="products-count">
						{total === 0 ? 'No hay productos que coincidan con los filtros.' : `Mostrando ${start}–${end} de ${total}`}
						{q && <> · búsqueda: “{q}”</>}
					</div>
				</div>
				<SearchToolbar
					q={q}
					sort={sort}
					per={per}
					cat={cat}
					categories={categories}
					base="/products"
					priceMin={hasMin ? priceMin : undefined}
					priceMax={hasMax ? priceMax : undefined}
					minBound={minBound}
					maxBound={maxBound}
				/>
			</header>

			<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
				{products.map((p: any) => <ProductCard key={p.id} product={p} />)}
				{products.length === 0 && (
					<div className="p-10 text-center border rounded-lg col-span-full bg-white/60 border-neutral-200">
						<p className="mb-4 text-sm text-neutral-600">No encontramos productos con esos criterios.</p>
						<Link href="/products" className="px-4 py-2 text-xs font-medium transition bg-white border rounded-md border-neutral-300 hover:bg-neutral-50">Limpiar filtros</Link>
					</div>
				)}
			</div>

			{totalPages > 1 && (
				<nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-2 pt-4">
					<PaginationControl current={currentPage} totalPages={totalPages} link={link} />
				</nav>
			)}
		</div>
	);
}

interface PaginationControlProps { current: number; totalPages: number; link: (page: number) => string }
function PaginationControl({ current, totalPages, link }: PaginationControlProps) {
	const pages: number[] = [];
	const window = 2; // pages around current
	const first = 1;
	const last = totalPages;
	for (let p = Math.max(first, current - window); p <= Math.min(last, current + window); p++) pages.push(p);
	if (!pages.includes(first)) pages.unshift(first);
	if (!pages.includes(last)) pages.push(last);
	const unique = Array.from(new Set(pages)).sort((a,b)=>a-b);
	const items: (number | 'gap')[] = [];
	unique.forEach((p,i) => {
		if (i>0 && p - unique[i-1] > 1) items.push('gap');
		items.push(p);
	});

	return (
		<div className="flex flex-wrap items-center gap-1">
			<Link
				href={link(Math.max(1, current - 1))}
				aria-disabled={current===1}
				className={`px-3 py-1.5 text-xs rounded-full border transition ${current===1?'border-neutral-200 text-neutral-400 cursor-not-allowed':'border-neutral-300 hover:bg-neutral-100'}`}
				aria-label="Anterior"
			>«</Link>
			{items.map((it, idx) => it === 'gap' ? (
				<span key={idx} className="px-2 text-xs select-none text-neutral-400">…</span>
			) : (
				<Link
					key={it}
					href={link(it)}
					aria-current={it===current? 'page':undefined}
					className={`px-3 py-1.5 text-xs rounded-full border transition ${it===current? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}
				>{it}</Link>
			))}
			<Link
				href={link(Math.min(totalPages, current + 1))}
				aria-disabled={current===totalPages}
				className={`px-3 py-1.5 text-xs rounded-full border transition ${current===totalPages?'border-neutral-200 text-neutral-400 cursor-not-allowed':'border-neutral-300 hover:bg-neutral-100'}`}
				aria-label="Siguiente"
			>»</Link>
		</div>
	);
}
