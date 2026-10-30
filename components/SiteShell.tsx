"use client";
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { NavBar } from './Navbar';
import Footer from './Footer';
import { ScrollToTop } from './ScrollToTop';

/**
 * Estructura de la tienda pública (barra superior, contenido y pie de página).
 * El panel /admin tiene su propia barra lateral y encabezado, por eso allí NO se muestra la barra pública:
 * de lo contrario quedaba encima de la barra lateral del panel.
 */
export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return (
      <>
        <ScrollToTop />
        {children}
      </>
    );
  }
  return (
    <>
      <header className="sticky top-0 z-50 border-b shadow-sm bg-white/80 backdrop-blur">
        <NavBar />
      </header>
      <ScrollToTop />
      <main id="main-content" tabIndex={-1} className="outline-none w-full min-h-[36vh] max-w-7xl px-2 py-8 mx-auto">{children}</main>
      <Footer />
    </>
  );
}
