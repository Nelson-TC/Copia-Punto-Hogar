"use client";
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../src/lib/format';
import Image from 'next/image';

interface NavLink { href: string; label: string; auth?: boolean; admin?: boolean; }

const links: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/products', label: 'Productos' },
  { href: '/categories', label: 'Categorías' },
  { href: '/cart', label: 'Carrito' },
  { href: '/account', label: 'Mi Cuenta', auth: true },
  { href: '/admin', label: 'Admin', auth: true, admin: true }
];

export function NavBar() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapperRef = useRef<HTMLDivElement|null>(null); // wraps button + panel
  const menuPanelRef = useRef<HTMLDivElement|null>(null);
  const menuButtonRef = useRef<HTMLButtonElement|null>(null);
  const boxRef = useRef<HTMLDivElement|null>(null);
  // Search results container (rendered in a portal)
  const resultsRef = useRef<HTMLDivElement|null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false); // for portal safety
  useEffect(()=>{ setMounted(true); }, []);
  // Load cart count on mount and after search navigation events
  async function loadCartCount() {
    try {
      const res = await fetch('/api/cart', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const total = Array.isArray(data.items) ? data.items.reduce((s: number,i:any)=>s + (i.qty||0),0) : 0;
      setCartCount(total);
    } catch {}
  }
  useEffect(()=>{ loadCartCount(); }, []);
  // Listen to custom cart update events to refresh badge instantly
  useEffect(()=>{
    function handle(){ loadCartCount(); }
    window.addEventListener('cart:updated', handle);
    return () => window.removeEventListener('cart:updated', handle);
  }, []);
  const timer = useRef<any>();

  useEffect(()=>{
  if (!q || q.length < 2) { setResults([]); setSearchLoading(false); return; }
  setSearchLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.items || []);
      } catch { setResults([]); }
  finally { setSearchLoading(false); }
    }, 250);
  }, [q]);

  // close search & menu dropdown on outside click
  useEffect(()=>{
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      // Only close search results if click is outside both the input box area AND
      // the results panel (which is portaled to document.body)
      const clickedInsideSearchBox = !!(boxRef.current && boxRef.current.contains(target));
      const clickedInsideResults = !!(resultsRef.current && resultsRef.current.contains(target));
      if (!clickedInsideSearchBox && !clickedInsideResults) setShowResults(false);
      if (menuWrapperRef.current && !menuWrapperRef.current.contains(target)) setMenuOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  },[]);

  // Close menu on route change (pathname change)
  useEffect(()=>{ setMenuOpen(false); }, [pathname]);

  // Focus trap & ESC handling when menu open
  useEffect(()=>{
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    // Small delay to allow panel render
    requestAnimationFrame(()=>{
      const focusables = menuPanelRef.current?.querySelectorAll<HTMLElement>(
        'a, button, [tabindex]:not([tabindex="-1"])'
      );
      focusables && focusables[0]?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      if (e.key === 'Tab') {
        const focusables = menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length -1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    // Scroll lock for mobile sheet
    const mql = window.matchMedia('(max-width: 767px)');
    if (mql.matches) document.documentElement.classList.add('overflow-hidden');
    return ()=>{
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('overflow-hidden');
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, [menuOpen]);

  function go(slug: string) {
    setShowResults(false); setQ(''); setResults([]);
    router.push(`/products/${slug}`);
  }

  const navLinks = links.filter(l => {
    const perms = session?.permissions || [];
    if (l.admin && !(perms.includes('admin:access') || perms.includes('dashboard:access'))) return false;
    if (l.auth && !session) return false;
    if (!l.auth && (l.href === '/login' || l.href === '/register') && session) return false;
    return true;
  });

  return (
  <>
  <div className="relative w-full shadow-sm bg-gradient-to-b from-nav to-nav-dark">
    <div className="flex flex-wrap items-center w-full max-w-6xl px-4 pt-3 pb-2 mx-auto text-white gap-x-4 gap-y-2 md:h-16 md:flex-nowrap md:py-0 md:px-6">
        {/* Left: menu button + logo */}
        <div className="relative flex items-center gap-3" ref={menuWrapperRef}>
          <button
            ref={menuButtonRef}
            aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-controls="primary-menu-panel"
              onClick={()=>setMenuOpen(o=>!o)}
              className={`flex items-center justify-center text-sm font-medium transition border rounded-md w-9 h-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 backdrop-blur border-white/15 ${menuOpen ? 'bg-white/20 text-white' : 'text-white/90 bg-white/10 hover:bg-white/20'}`}
          >
              <span className="sr-only">{menuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}</span>
              <i className='bx bxs-category-alt text-[1.5rem]'></i>
          </button>
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex items-center justify-center bg-white rounded-lg shadow-sm h-10 w-11"><Image src="/images/logo-mark.webp" alt="Punto Hogar" width={34} height={29} priority /></span>
            <span className="hidden text-base font-bold tracking-tight sm:inline">Punto <span className="text-carrot">Hogar</span></span>
          </Link>
          {/* Overlay moved to portal to avoid being constrained by any transformed ancestor */}
          {/* (Portal is rendered at end of body; see below) */}
          {/* Panel: Mobile = side sheet; Desktop = dropdown */}
          <div
            id="primary-menu-panel"
            ref={menuPanelRef}
            role="menu"
            aria-label="Menú principal"
            className={`z-[70] origin-top-left text-neutral-200 focus:outline-none
              md:absolute md:top-full md:left-4 md:mt-2 md:w-60
              md:rounded-xl md:border md:border-white/10 md:shadow-lg md:bg-nav md:backdrop-blur
              md:transition md:data-[state=closed]:scale-95 md:data-[state=closed]:opacity-0
              md:data-[state=open]:scale-100 md:data-[state=open]:opacity-100
              fixed top-0 left-0 h-screen w-72 max-w-[80%] md:max-w-none md:h-auto md:translate-x-0
              flex flex-col gap-2 p-4 md:p-0 bg-nav
              transform transition-transform duration-100 ease-out
              ${menuOpen ? 'translate-x-0 data-[state=open]':'-translate-x-full md:translate-x-0 data-[state=closed] md:hidden'}
            `}
            data-state={menuOpen? 'open':'closed'}
          >
            <div className="flex items-center justify-between mb-2 md:hidden">
              <span className="text-sm font-medium tracking-wide uppercase text-white/80">Navegación</span>
              <button
                onClick={()=>setMenuOpen(false)}
                className="flex items-center justify-center w-8 h-8 text-white transition rounded-md bg-white/10 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60"
              >
                <span className="sr-only">Cerrar menú</span>
                <i className='bx bx-x text-[1.4rem]'></i>
              </button>
            </div>
            <ul className="text-sm divide-y divide-white/5 md:divide-y-0 md:py-1" data-menu-items>
              {navLinks.map(l => {
                const active = pathname === l.href;
                return (
                  <li key={l.href} role="none">
                    <Link
                      role="menuitem"
                      tabIndex={0}
                      href={l.href}
                      onClick={()=>{ setMenuOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-3 md:py-2 rounded-md outline-none transition group
                        ${active ? 'bg-white/10 text-white font-medium md:border-l-2 md:border-carrot' : 'text-neutral-300 hover:text-white hover:bg-white/5'}`}
                    >
                      <span className="truncate">{l.label}</span>
                      {active && <span className="ml-auto text-[10px] font-semibold tracking-wide text-carrot bg-white/10 px-1.5 py-0.5 rounded md:hidden">ACTIVO</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {/* Extra quick actions (optional future) */}
            {session && (
              <div className="hidden px-3 pt-1 pb-3 md:block">
                <p className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Accesos rápidos</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/cart" className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition">Carrito ({cartCount})</Link>
                  {loading && (
                    <span className="text-[11px] px-2 py-1 rounded bg-white/10 animate-pulse text-transparent select-none">Admin</span>
                  )}
                  {!loading && session && (session.permissions.includes('admin:access') || session.permissions.includes('dashboard:access')) && (
                    <Link href="/admin" className="text-[11px] px-2 py-1 rounded bg-carrot text-nav font-semibold hover:bg-carrot-dark transition">Admin</Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Center: search (full width on mobile, constrained on md+) */}
        <div className="order-last w-full md:order-none md:flex md:justify-center md:flex-1">
          <div ref={boxRef} className="relative w-full md:max-w-md">
            <form action="/search" method="get" role="search" className="relative" onSubmit={()=>{ setShowResults(false); }}>
              <input
                name="q"
                value={q}
                onChange={e=>{ setQ(e.target.value); setShowResults(true); setMenuOpen(false);} }
                onFocus={()=>{ setShowResults(true); setMenuOpen(false); }}
                placeholder="Buscar productos..."
                className="w-full px-4 py-2 pr-20 text-sm border rounded-full shadow-sm bg-white/95 text-neutral-800 border-white/30 placeholder-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60"
                aria-label="Buscar productos"
                autoComplete='off'
              />
              {q && (
                <button type="button" onClick={()=>{ setQ(''); setResults([]); setShowResults(false); }} className="absolute p-1 -translate-y-1/2 rounded-full text-neutral-400 right-14 top-1/2 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50" aria-label="Limpiar búsqueda">
                  <i className='bx bx-x text-[1.2rem]' />
                </button>
              )}
              <button type="submit" className="absolute font-medium text-black -translate-y-1/2 rounded-full right-0 top-1/2 bg-carrot hover:bg-carrot-dark px-3 py-1.5 flex items-center gap-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60" aria-label="Ver todos los resultados">
                <i className='text-base bx bx-search' />
                <span className="hidden sm:inline">Buscar</span>
              </button>
              <span className="absolute text-xs -translate-y-1/2 pointer-events-none text-neutral-400 right-24 top-1/2">
                {searchLoading ? (<i className="bx bx-dots-horizontal-rounded text-[1.5rem] animate-pulse" />) : null}
              </span>
            </form>
            {mounted && showResults && (q.length === 0 || (q.length>=2)) && createPortal(
              <div ref={resultsRef} className="fixed inset-x-2 top-[68px] z-[90] md:inset-auto md:left-1/2 md:-translate-x-1/2 md:top-16 md:w-[38rem]">
                <div className="overflow-hidden bg-white border shadow-2xl rounded-xl text-neutral-700">
                  {searchLoading && <div className="px-4 py-3 text-xs text-neutral-500">Buscando...</div>}
                  {!searchLoading && results.length === 0 && q.length>=2 && (
                    <div className="px-4 py-3 text-xs text-neutral-500">Sin resultados</div>
                  )}
                  <ul className="text-sm divide-y" role="listbox" aria-label="Resultados de búsqueda">
                    {results.slice(0, 6).map(r => (
                      <li key={r.id} role="option" aria-selected="false">
                        <Link
                          href={`/products/${r.slug}`}
                          prefetch={false}
                          onClick={()=>{ setShowResults(false); setQ(''); setResults([]); }}
                          className="flex items-center w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50"
                        >
                          <div className="flex items-center justify-center flex-none w-10 h-10 overflow-hidden bg-white border rounded">
                            {/* small thumbnail with fallback */}
                            <img src={r.imageUrl || '/images/noimage.webp'} alt={r.name} className="object-cover w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-tight truncate">{r.name}</div>
                          </div>
                          {r.price != null && (
                            <div className="text-xs font-medium text-carrot-dark whitespace-nowrap" aria-label="Precio">{formatCurrency(Number(r.price))}</div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {q.length>=2 && !searchLoading && results.length > 0 && (
                    <div className="p-2 text-right bg-neutral-50">
                      <Link href={`/search?q=${encodeURIComponent(q)}`} onClick={()=>setShowResults(false)} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium transition rounded-md bg-carrot text-nav hover:bg-carrot-dark">
                        Ver todos ({results.length})
                        <i className='text-sm bx bx-right-arrow-alt'/>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            , document.body)}
          </div>
        </div>
    {/* Right: auth / account */}
    <div className="flex items-center gap-2 text-xs sm:text-sm md:gap-3">
          {!session && (
            <div className="flex items-center gap-3">
              <Link href="/cart" className="relative p-1 transition rounded hover:bg-white/20" aria-label="Carrito">
                <i className='text-white bx bxs-cart text-[1.5rem]'></i>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-carrot text-[10px] font-semibold text-black flex items-center justify-center shadow">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              <Link href="/login" className="px-3 py-1.5 rounded border border-white/15 bg-white/10 hover:bg-white/20 text-white transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Ingresar</Link>
              <Link href="/register" className="px-3 py-1.5 font-medium text-nav bg-carrot rounded hover:bg-carrot-dark hover:text-white transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Registrar</Link>
            </div>
          )}
          {session && (
            <div className="flex items-center gap-3">
              <Link href="/account" className="p-1 transition rounded hover:bg-white/20 whitespace-nowrap">
              <i className='text-white bx bxs-user text-[1.5rem]'></i>
              </Link>
              <Link href="/cart" className="relative p-1 transition rounded hover:bg-white/20">
                <i className='text-white bx bxs-cart text-[1.5rem]'></i>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-carrot text-[10px] font-semibold text-black flex items-center justify-center shadow">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              {loading && (
                <span className="px-3 py-1.5 rounded bg-white/10 animate-pulse text-transparent select-none">Admin</span>
              )}
              {!loading && session && (session.permissions.includes('admin:access') || session.permissions.includes('dashboard:access')) && (
                <Link href="/admin" className="px-3 py-1.5 rounded hover:bg-white/15 transition text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Admin</Link>
              )}
            </div>
          )}
        </div>
    </div>
  </div>
    {/* Portal overlay (outside stacking/transform contexts) */}
    {mounted && createPortal(
      <div
        aria-hidden="true"
        onClick={()=>setMenuOpen(false)}
        // Overlay cubre sólo el área fuera del panel (panel = w-72) para que éste no reciba el blur
        className={`fixed inset-y-0 right-0 ${menuOpen ? 'left-72':'left-0'} z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${menuOpen? 'opacity-100 pointer-events-auto':'opacity-0 pointer-events-none'}`}
      />,
      document.body
    )}
  </>
  );
}
