"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatCurrency } from '../src/lib/format';
import { addToCart } from '../src/lib/cart';
import { showToast } from 'nextjs-toast-notify';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    price: any;
    imageUrl?: string | null;
    stock?: number;
    category?: { name: string } | null;
  };
  showDescription?: boolean;
  variant?: 'default' | 'compact';
  highlightedName?: React.ReactNode; // permite pasar nombre con <mark>
}

export default function ProductCard({ product, showDescription = true, variant='default', highlightedName }: ProductCardProps) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const price = formatCurrency(Number(product.price));
  const image = product.imageUrl || '/images/noimage.webp';
  const compact = variant === 'compact';
  // Disponibilidad: sin dato de stock se asume disponible (compatibilidad con respuestas antiguas).
  const stock = typeof product.stock === 'number' ? product.stock : Infinity;
  const soldOut = stock <= 0;
  const maxQty = Math.min(99, stock);

  function handleNavigate() {
    router.push(`/products/${product.slug}`);
  }

  async function handleAdd(e?: React.MouseEvent) {
    if (e) e.stopPropagation(); // evita navegación
    if (adding || soldOut) return;
    setAdding(true);
    try {
      await addToCart(product.id, qty);
      showToast.success(`${product.name} x${qty} agregado`, { duration: 2200, position: 'top-right' });
    } catch (err: any) {
      showToast.error(err?.message || 'Error al agregar', { duration: 3000, position: 'top-right' });
    } finally { setAdding(false); }
  }

  function inc(e: React.MouseEvent) { e.stopPropagation(); setQty(q => Math.min(maxQty, q + 1)); }
  function dec(e: React.MouseEvent) { e.stopPropagation(); setQty(q => Math.max(1, q - 1)); }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(); } }}
      className={`relative flex flex-col h-full transition bg-white border shadow-sm cursor-pointer group rounded-xl border-neutral-200 hover:shadow-md hover:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60`}
      aria-label={product.name}
    >
      <div className={`relative w-full ${compact ? 'aspect-[4/3]' : 'aspect-square'} bg-neutral-100`}>
        <Image
          src={image}
          alt={product.name}
          fill
          sizes={compact ? "(max-width:768px) 50vw, (max-width:1200px) 33vw, 240px" : "(max-width:768px) 50vw, (max-width:1200px) 33vw, 300px"}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {product.category && (
          <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur ${compact? 'px-1.5 py-0.5 text-[9px]':'px-2 py-1 text-[10px]'} font-medium text-neutral-700 ring-1 ring-black/5`}>
            <i className='bx bxs-tag-alt text-carrot text-[12px]' /> {product.category.name}
          </span>
        )}
        {soldOut && (
          <span className="absolute top-2 right-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">Agotado</span>
        )}
        {!soldOut && stock <= 5 && (
          <span className="absolute top-2 right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">Quedan {stock}</span>
        )}
      </div>
      <div className={`flex flex-col flex-1 gap-2 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="space-y-1">
          <h3 className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold leading-snug text-neutral-900 line-clamp-2`}>{highlightedName ?? product.name}</h3>
          {showDescription && product.description && variant==='default' && (
            <p className="text-[11px] leading-relaxed text-neutral-600 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between">
            <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-bold text-nav`}>{price}</span>
          </div>
          {variant==='default' ? (
            <div className="flex items-stretch gap-2" onClick={e => e.stopPropagation()}>
              <div className="flex items-center rounded-full border border-neutral-300 bg-neutral-50 text-[11px] overflow-hidden">
                <button type="button" onClick={dec} className="px-2 h-7 text-neutral-600 hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">-</button>
                <span className="flex items-center px-2 font-medium select-none h-7 text-neutral-700">{qty}</span>
                <button type="button" onClick={inc} className="px-2 h-7 text-neutral-600 hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">+</button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || soldOut}
                className="h-7 px-3 inline-flex items-center gap-1 rounded-full bg-carrot text-[11px] font-semibold text-nav hover:bg-carrot-dark transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {adding ? <i className='text-sm bx bx-loader-alt animate-spin' /> : <i className='text-sm bx bxs-cart-add' />}
                <span>{soldOut ? 'Agotado' : adding ? '...' : 'Añadir'}</span>
              </button>
            </div>
          ) : (
            <div onClick={e=>e.stopPropagation()}>
              <button
                type="button"
                onClick={()=>handleAdd()}
                disabled={adding || soldOut}
                className="w-full h-7 px-2 inline-flex justify-center items-center gap-1 rounded-md bg-carrot text-[10px] font-semibold text-nav hover:bg-carrot-dark transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {adding ? <i className='text-sm bx bx-loader-alt animate-spin' /> : <i className='text-sm bx bxs-cart-add' />}
                <span>{soldOut ? 'Agotado' : adding ? '...' : 'Agregar'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
