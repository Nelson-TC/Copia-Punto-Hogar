"use client";
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface SearchToolbarProps {
  q: string;
  sort: string;
  per: number;
  cat: string;
  categories: { id: string; name: string; slug: string }[];
  base?: string;
  priceMin?: number; // applied filter
  priceMax?: number; // applied filter
  minBound: number; // global min
  maxBound: number; // global max
}

export default function SearchToolbar({ q, sort, per, cat, categories, base = '/search', priceMin, priceMax, minBound, maxBound }: SearchToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localMin, setLocalMin] = React.useState<number>(priceMin ?? minBound);
  const [localMax, setLocalMax] = React.useState<number>(priceMax ?? maxBound);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  function update(next: Partial<{ sort: string; per: number|string; cat: string; page?: number; priceMin?: number|string; priceMax?: number|string }>) {
    const sp = new URLSearchParams(params?.toString() || '');
    if (q) sp.set('q', q); else sp.delete('q');
    if (next.sort) sp.set('sort', next.sort); else sp.set('sort', sort);
    if (next.per) sp.set('per', String(next.per)); else sp.set('per', String(per));
    if (next.cat !== undefined) {
      if (next.cat) sp.set('cat', next.cat); else sp.delete('cat');
    } else if (cat) sp.set('cat', cat);
    const useMin = next.priceMin !== undefined ? next.priceMin : (priceMin !== undefined ? priceMin : undefined);
    const useMax = next.priceMax !== undefined ? next.priceMax : (priceMax !== undefined ? priceMax : undefined);
    if (useMin !== undefined) sp.set('priceMin', String(useMin)); else sp.delete('priceMin');
    if (useMax !== undefined) sp.set('priceMax', String(useMax)); else sp.delete('priceMax');
    // reiniciar page si se cambió algo importante
    sp.delete('page');
    const url = `${base}?${sp.toString()}`;
    startTransition(()=> router.push(url));
  }

  function resetFilters() {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    const qs = sp.toString();
    startTransition(()=> router.push(qs ? `${base}?${qs}` : base));
  }

  function onRangeChange(newMin: number, newMax: number) {
    setLocalMin(newMin); setLocalMax(newMax);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{
      update({ priceMin: newMin !== minBound ? newMin : undefined, priceMax: newMax !== maxBound ? newMax : undefined });
    }, 400);
  }

  // Keep local state in sync if route changes externally
  React.useEffect(()=>{ setLocalMin(priceMin ?? minBound); }, [priceMin, minBound]);
  React.useEffect(()=>{ setLocalMax(priceMax ?? maxBound); }, [priceMax, maxBound]);

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1">
        <label htmlFor="sort" className="hidden font-medium text-neutral-600 sm:block">Ordenar</label>
        <select
          id="sort"
          defaultValue={sort}
          onChange={e=>update({ sort: e.target.value })}
          disabled={isPending}
          className="px-2 py-1 bg-white border rounded border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 disabled:opacity-50"
        >
          <option value="new">Nuevos</option>
          <option value="price_asc">Precio ↑</option>
          <option value="price_desc">Precio ↓</option>
            <option value="name">Nombre A-Z</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        <label htmlFor="per" className="hidden font-medium text-neutral-600 sm:block">Por página</label>
        <select
          id="per"
          defaultValue={String(per)}
          onChange={e=>update({ per: e.target.value })}
          disabled={isPending}
          className="px-2 py-1 bg-white border rounded border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 disabled:opacity-50"
        >
          {[12,24,36,48].map(o=> <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <label htmlFor="cat" className="hidden font-medium text-neutral-600 sm:block">Categoría</label>
        <select
          id="cat"
          defaultValue={cat || ''}
          onChange={e=>update({ cat: e.target.value })}
          disabled={isPending}
          className="px-2 py-1 bg-white border rounded border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 disabled:opacity-50"
        >
          <option value="">Todas</option>
          {categories.map(c=> <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      {isPending && <span className="text-neutral-400">Actualizando…</span>}
      <div className="flex items-center w-full gap-2 sm:w-auto sm:ml-2">
        <PriceRange
          minBound={minBound}
          maxBound={maxBound}
          valueMin={localMin}
          valueMax={localMax}
          onChange={onRangeChange}
        />
      </div>
      <button
        type="button"
        onClick={resetFilters}
        className="px-3 py-1 font-medium transition bg-white border rounded hover:bg-neutral-50 border-neutral-300 text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50"
      >Limpiar filtros</button>
    </div>
  );
}

interface PriceRangeProps {
  minBound: number; maxBound: number; valueMin: number; valueMax: number; onChange: (min:number,max:number)=>void;
}
function PriceRange({ minBound, maxBound, valueMin, valueMax, onChange }: PriceRangeProps) {
  // We implement a dual slider using two range inputs overlapped.
  const min = Math.min(minBound, maxBound);
  const max = Math.max(minBound, maxBound);
  const displayMin = Math.min(valueMin, valueMax);
  const displayMax = Math.max(valueMin, valueMax);
  function handleMin(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    onChange(Math.min(v, displayMax), displayMax);
  }
  function handleMax(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    onChange(displayMin, Math.max(v, displayMin));
  }
  const span = max - min || 1; // evita división entre cero si todos los productos cuestan lo mismo
  const percentMin = ((displayMin - min)/span)*100;
  const percentMax = ((displayMax - min)/span)*100;
  return (
    <div className="flex flex-col gap-1 min-w-[210px]">
      <div className="flex items-center justify-between text-[10px] font-medium text-neutral-500">
        <span>Q{displayMin.toFixed(0)}</span>
        <span className="text-neutral-400">Precio</span>
        <span>Q{displayMax.toFixed(0)}</span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded bg-neutral-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded bg-carrot"
          style={{ left: `${percentMin}%`, right: `${100 - percentMax}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={displayMin}
          onChange={handleMin}
          className="absolute inset-0 w-full h-6 bg-transparent appearance-none pointer-events-auto"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={displayMax}
          onChange={handleMax}
          className="absolute inset-0 w-full h-6 bg-transparent appearance-none pointer-events-auto"
        />
      </div>
    </div>
  );
}

