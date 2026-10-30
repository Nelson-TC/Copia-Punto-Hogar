import ProductCard from '../../components/ProductCard';
import Link from 'next/link';
import { prisma } from '../../src/lib/prisma';
import { cache } from 'react';
import SearchToolbar from '../../components/SearchToolbar';
import { plainProduct } from '../../src/lib/serialize';

export const dynamic = 'force-dynamic';

interface SearchParams { q?: string; page?: string; per?: string; sort?: string; cat?: string; priceMin?: string; priceMax?: string }
const DEFAULT_PER = 24; const MAX_PER = 60;

function parsePagination(sp: SearchParams) {
  const page = Math.max(parseInt(sp.page || '1', 10) || 1, 1);
  let per = parseInt(sp.per || String(DEFAULT_PER), 10) || DEFAULT_PER;
  per = Math.min(Math.max(6, per), MAX_PER);
  return { page, per };
}

const getActiveCategories = cache(async ()=>{
  return prisma.category.findMany({ where: { active: true }, select: { id: true, name: true, slug: true } });
});

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q || '').trim();
  const { page, per } = parsePagination(searchParams);
  const sort = (searchParams.sort || 'new').toLowerCase();
  const cat = (searchParams.cat || '').trim();
  const priceMinFilter = parseFloat(searchParams.priceMin || '');
  const priceMaxFilter = parseFloat(searchParams.priceMax || '');

  if (!q) return <EmptyState title="Búsqueda" message="Ingresa un término para buscar productos." focusSearch />;
  if (q.length < 2) return <EmptyState title="Término muy corto" message="Escribe al menos 2 caracteres." />;

  const categories = await getActiveCategories();
  const bounds = await prisma.product.aggregate({ where: { active: true }, _min: { price: true }, _max: { price: true } });
  const minBound = bounds._min.price ? Number(bounds._min.price) : 0;
  const maxBound = bounds._max.price ? Number(bounds._max.price) : 0;
  const where: any = {
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { description: { contains: q, mode: 'insensitive' as const } }
    ],
    active: true
  };
  if (cat) {
    const found = categories.find(c=>c.slug===cat || c.id===cat);
    if (found) where.category = { id: found.id };
  }
  // price range filters
  const hasMin = !Number.isNaN(priceMinFilter);
  const hasMax = !Number.isNaN(priceMaxFilter);
  if (hasMin || hasMax) {
    where.price = {};
    if (hasMin) where.price.gte = priceMinFilter;
    if (hasMax) where.price.lte = priceMaxFilter;
  }
  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / per));
  const currentPage = Math.min(page, totalPages);
  let orderBy: any = { createdAt: 'desc' };
  if (sort === 'price_asc') orderBy = { price: 'asc' };
  else if (sort === 'price_desc') orderBy = { price: 'desc' };
  else if (sort === 'name') orderBy = { name: 'asc' };
  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy,
    skip: (currentPage - 1) * per,
    take: per
  });
  const start = total === 0 ? 0 : (currentPage - 1) * per + 1;
  const end = Math.min(total, currentPage * per);
  const highlight = (name: string) => {
    if (!q) return name;
    try {
      const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig');
      const parts = name.split(re);
      return parts.map((p,i)=> re.test(p) ? <mark key={i} className="px-0.5 rounded bg-carrot/30 text-neutral-900">{p}</mark> : p);
    } catch { return name; }
  };

  function buildQS(next: Partial<SearchParams>) {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('sort', next.sort || sort);
    params.set('per', String(next.per || per));
    if (next.page) params.set('page', String(next.page)); else if (page>1) params.set('page', String(page));
    if (next.cat !== undefined) {
      if (next.cat) params.set('cat', next.cat); // else omit
    } else if (cat) params.set('cat', cat);
    const appliedMin = next.priceMin !== undefined ? next.priceMin : (searchParams.priceMin || '');
    const appliedMax = next.priceMax !== undefined ? next.priceMax : (searchParams.priceMax || '');
    if (appliedMin) params.set('priceMin', String(appliedMin));
    if (appliedMax) params.set('priceMax', String(appliedMax));
    return `/search?${params.toString()}`;
  }

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto space-y-8 md:px-6">
      <header className="flex flex-col gap-4 md:items-start md:flex-row md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Resultados para &quot;{q}&quot;</h1>
          <p className="text-sm text-neutral-600">{total === 0 ? 'Sin coincidencias.' : <>Mostrando <span className="font-medium">{start}-{end}</span> de <span className="font-medium">{total}</span> producto{total!==1 && 's'}.</>}</p>
        </div>
        <SearchToolbar
          q={q}
          sort={sort}
          per={per}
          cat={cat}
          categories={categories}
          priceMin={hasMin? priceMinFilter : undefined}
          priceMax={hasMax? priceMaxFilter : undefined}
          minBound={minBound}
          maxBound={maxBound}
        />
      </header>
      {total === 0 && (
        <div className="p-10 text-center border rounded-lg bg-white/60 backdrop-blur border-neutral-200">
          <p className="mb-4 text-sm text-neutral-600">No encontramos productos que coincidan con tu búsqueda.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link href="/products" className="px-4 py-2 font-medium transition bg-white border rounded-md border-neutral-300 hover:bg-neutral-50">Ver todos los productos</Link>
          </div>
        </div>
      )}
      {products.length > 0 && (
  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {products.map(p => (
            <ProductCard
              key={p.id}
              product={plainProduct(p) as any}
              showDescription={false}
              variant="compact"
              highlightedName={highlight(p.name)}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 pt-4">
          <Pagination base="/search" current={currentPage} totalPages={totalPages} per={per} q={q} />
          <PerPageSelector base="/search" per={per} q={q} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message, focusSearch = false }: { title: string; message: string; focusSearch?: boolean }) {
  return (
    <div className="max-w-2xl px-4 py-16 mx-auto space-y-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-neutral-600">{message}</p>
      {focusSearch && (
        <form action="/search" className="max-w-md mx-auto" role="search">
          <div className="relative">
            <input name="q" autoFocus placeholder="Buscar productos..." className="w-full px-4 py-2 pr-10 text-sm bg-white border rounded-full shadow-sm border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60" autoComplete='off' />
            <button className="absolute flex items-center justify-center p-1 text-black transition-colors -translate-y-1/2 rounded-full bg-carrot hover:bg-carrot-dark right-1 top-1/2" aria-label="Buscar">
              <i className='bx bx-search text-[1.5rem]' />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface PaginationProps { base: string; current: number; totalPages: number; per: number; q: string }
function Pagination({ base, current, totalPages, per, q }: PaginationProps) {
  function link(p: number) {
    const params = new URLSearchParams();
    params.set('q', q);
    if (p > 1) params.set('page', String(p));
    if (per !== DEFAULT_PER) params.set('per', String(per));
    const qs = params.toString(); return `${base}?${qs}`;
  }
  const window = 2; const pages: number[] = [];
  for (let i = Math.max(1, current - window); i <= Math.min(totalPages, current + window); i++) pages.push(i);
  if (!pages.includes(1)) pages.unshift(1);
  if (!pages.includes(totalPages)) pages.push(totalPages);
  const seq: (number|'gap')[] = []; pages.sort((a,b)=>a-b).forEach((p,i,arr)=>{ if(i>0 && p - arr[i-1] > 1) seq.push('gap'); seq.push(p); });
  return (
    <nav aria-label="Paginación de resultados" className="flex flex-wrap items-center gap-1 text-xs">
      <a aria-disabled={current===1} className={`px-3 py-1 rounded border ${current===1?'cursor-not-allowed text-neutral-400 border-neutral-200':'border-neutral-300 hover:bg-neutral-100'}`} href={current===1? undefined: link(current-1)}>«</a>
      {seq.map((it,i)=> it==='gap'? <span key={i} className="px-2">…</span> : (
        <a key={it} href={link(it)} aria-current={it===current?'page':undefined} className={`px-3 py-1 rounded border ${it===current? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{it}</a>
      ))}
      <a aria-disabled={current===totalPages} className={`px-3 py-1 rounded border ${current===totalPages?'cursor-not-allowed text-neutral-400 border-neutral-200':'border-neutral-300 hover:bg-neutral-100'}`} href={current===totalPages? undefined: link(current+1)}>»</a>
    </nav>
  );
}

function PerPageSelector({ base, per, q }: { base: string; per: number; q: string }) {
  const options = [12,24,36,48];
  return (
    <div className="text-[11px] text-neutral-500 flex items-center gap-1 flex-wrap">Por página:
      {options.map(o => {
        const params = new URLSearchParams();
        params.set('q', q);
        if (o !== DEFAULT_PER) params.set('per', String(o));
        const href = `${base}?${params.toString()}`;
        return <a key={o} href={href} className={`px-2 py-1 rounded border ${o===per? 'bg-carrot text-nav border-carrot font-semibold':'border-neutral-300 hover:bg-neutral-100'}`}>{o}</a>;
      })}
    </div>
  );
}
