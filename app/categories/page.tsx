import Link from 'next/link';
import { prisma } from '../../src/lib/prisma';
import { cache } from 'react';

export const dynamic = 'force-dynamic';

interface SearchParams { q?: string; }

const getCategories = cache(async (q?: string) => {
	const where: any = { active: true }; // el cliente solo ve categorías activas
	if (q && q.trim()) {
		where.name = { contains: q.trim(), mode: 'insensitive' };
	}
	return prisma.category.findMany({
		where,
		orderBy: { name: 'asc' },
		select: { id: true, name: true, slug: true, active: true, imageUrl: true, products: { select: { id: true }, take: 1 } }
	});
});

export default async function CategoriesIndexPage({ searchParams }: { searchParams: SearchParams }) {
	const q = (searchParams.q || '').trim();
	const categories = await getCategories(q);
	return (
		<div className="max-w-6xl px-4 py-8 mx-auto space-y-10 md:px-6">
			<header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div className="space-y-3">
					<h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
					<p className="text-sm text-neutral-600">Explora las agrupaciones del catálogo. {categories.length>0 && <span className="text-neutral-500">Total: <strong>{categories.length}</strong></span>}</p>
				</div>
				<CategorySearch initial={q} />
			</header>
			<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
				{categories.map(c => (
					<CategoryCard key={c.id} cat={c} />
				))}
				{categories.length === 0 && (
					<div className="p-10 text-center border col-span-full rounded-xl bg-white/60 backdrop-blur border-neutral-200">
						<p className="mb-4 text-sm text-neutral-600">No hay categorías que coincidan.</p>
						<div className="flex justify-center">
							<Link href="/categories" className="px-4 py-2 text-xs font-medium transition bg-white border rounded-md hover:bg-neutral-50 border-neutral-300">Limpiar búsqueda</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function CategoryCard({ cat }: { cat: { id: string; name: string; slug: string; active: boolean; imageUrl?: string|null } }) {
	const image = cat.imageUrl || '/images/noimage.webp';
	return (
		<Link
			href={`/categories/${cat.slug}`}
			className="relative flex flex-col overflow-hidden transition bg-white border shadow-sm group rounded-xl border-neutral-200 hover:shadow-md hover:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60"
		>
			<div className="relative w-full overflow-hidden aspect-square bg-neutral-100">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={image} alt={cat.name} className="object-cover w-full h-full transition duration-300 group-hover:scale-[1.04]" />
				<div className="absolute inset-0 transition bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-60 group-hover:opacity-70" />
				{!cat.active && (
					<span className="absolute top-2 right-2 text-[10px] font-medium px-2 py-1 rounded-full bg-red-500 text-white shadow">Inactiva</span>
				)}
			</div>
			<div className="flex flex-col gap-2 p-4">
				<h2 className="text-sm font-semibold leading-snug text-neutral-900 line-clamp-2">{cat.name}</h2>
				<div className="flex items-center gap-2 text-[11px] text-neutral-500">
					<i className='text-base bx bxs-collection text-carrot' />
					<span>Ver productos</span>
				</div>
			</div>
			<span className="absolute px-2 py-1 text-[10px] font-medium tracking-wide rounded-full shadow top-2 left-2 bg-white/90 backdrop-blur text-neutral-700 ring-1 ring-black/5">CAT</span>
		</Link>
	);
}

// Client search component
// We intentionally keep it tiny to avoid a full separate file; can be extracted later.
function CategorySearch({ initial }: { initial: string }) {
	return (
		<form action="/categories" role="search" className="relative w-full max-w-xs">
			<input
				name="q"
				defaultValue={initial}
				placeholder="Buscar categoría..."
				className="w-full px-4 py-2 pr-10 text-sm bg-white border rounded-full shadow-sm border-neutral-300 placeholder-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60"
			/>
			{initial && (
				<a href="/categories" className="absolute -translate-y-1/2 right-8 top-1/2 text-neutral-400 hover:text-neutral-600" aria-label="Limpiar">
					<i className='text-lg bx bx-x' />
				</a>
			)}
			<button className="absolute -translate-y-1/2 right-2 top-1/2 text-neutral-500 hover:text-neutral-700" aria-label="Buscar">
				<i className='text-lg bx bx-search' />
			</button>
		</form>
	);
}
