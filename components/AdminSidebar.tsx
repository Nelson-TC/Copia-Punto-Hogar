"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../src/lib/use-permissions';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: 'bx bxs-dashboard', perm: 'dashboard:access' },
  { href: '/admin/categories', label: 'Categorías', icon: 'bx bxs-category', perm: 'category:read' },
  { href: '/admin/products', label: 'Productos', icon: 'bx bxs-package', perm: 'product:read' },
  { href: '/admin/orders', label: 'Pedidos', icon: 'bx bxs-cart-alt', perm: 'order:read' },
  { href: '/admin/users', label: 'Usuarios', icon: 'bx bxs-user', perm: 'user:read' },
  { href: '/admin/roles', label: 'Roles', icon: 'bx bxs-lock-alt', perm: 'role:read' },
  { href: '/admin/audit', label: 'Auditoría', icon: 'bx bxs-detail', perm: 'audit:read' }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement|null>(null);
  // Cerrar en cambio de ruta
  useEffect(()=>{ setOpen(false); }, [pathname]);

  // Focus first nav link when opening on mobile
  useEffect(()=>{
    if (open) {
      const mql = window.matchMedia('(min-width: 768px)');
      if (!mql.matches) {
        requestAnimationFrame(()=>{ firstLinkRef.current?.focus(); });
      }
    }
  }, [open]);

  // ESC to close and scroll locking on mobile
  useEffect(()=>{
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const mql = window.matchMedia('(max-width: 767px)');
    if (open && mql.matches) {
      document.documentElement.classList.add('overflow-hidden');
    } else {
      document.documentElement.classList.remove('overflow-hidden');
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, [open]);
  const { can } = usePermissions();
  const visibleItems = navItems.filter(i => can(i.perm));
  return (
    <>
      <button
        onClick={()=>setOpen(o=>!o)}
        className="fixed z-40 flex items-center justify-center w-full h-10 text-sm left-0 font-medium text-white transition rounded-b-md shadow md:hidden top-14 bg-nav/80 backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot"
        aria-expanded={open}
        aria-controls="admin-sidebar"
        aria-label={open? 'Cerrar menú de administración':'Abrir menú de administración'}
      >
        <i className={`bx ${open?'bx-x':'bx-menu'} text-[1.5rem]`}></i>
        <span>Menú administrador</span>
      </button>
      {/* Overlay mobile */}
      <div
        aria-hidden={open? 'false':'true'}
        onClick={()=>setOpen(false)}
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${open? 'opacity-100 pointer-events-auto':'opacity-0 pointer-events-none'}`}
      />
      <aside id="admin-sidebar" aria-label="Navegación de administración" className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-nav text-neutral-100 border-r border-white/10 transform transition-transform duration-200 md:translate-x-0 ${open? 'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between px-4 border-b h-14 border-white/10">
          <span className="text-sm font-semibold tracking-wide">Admin</span>
          <span className="hidden text-[10px] px-2 py-0.5 rounded bg-carrot text-nav font-semibold md:inline-block">Panel</span>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto text-sm">
          <ul className="px-3 space-y-1">
            {visibleItems.map((item, idx) => {
              const path = pathname || '';
              const active = path === item.href || (item.href !== '/admin' && path.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active? 'page': undefined}
                    ref={idx===0 ? firstLinkRef : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 ${active? 'bg-white/10 text-white font-medium':'text-neutral-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    <i className={`${item.icon} text-[1.2rem] opacity-80`}></i>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {/* <div className="p-3 border-t border-white/10 text-[11px] text-neutral-400">
          <p className="leading-relaxed">Atajos: <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded">/</kbd> buscar, <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded">Esc</kbd> cerrar.</p>
        </div> */}
      </aside>
    </>
  );
}
