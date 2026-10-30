"use client";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
  <footer className="mt-20 bg-gradient-to-b from-nav to-nav-dark text-white/90">
      <div className="max-w-6xl px-6 py-14 mx-auto grid gap-12 text-sm md:grid-cols-4">
        <div className="space-y-4">
          <h3 className="text-base font-semibold tracking-wide text-white">Punto Hogar</h3>
          <p className="leading-relaxed text-white/80">Tu tienda por departamentos en línea: artículos para el hogar, ferretería, iluminación, jardín y más, en un solo lugar.</p>
          <p className="text-xs text-white/55">© {year} Punto Hogar</p>
        </div>
        <div className="space-y-4">
          <h4 className="font-semibold text-white">Tienda</h4>
          <ul className="space-y-2">
            <li><a className="transition text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded underline-offset-4 hover:underline" href="/products">Productos</a></li>
            <li><a className="transition text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded underline-offset-4 hover:underline" href="/categories">Categorías</a></li>
            <li><a className="transition text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded underline-offset-4 hover:underline" href="/cart">Carrito</a></li>
            <li><a className="transition text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded underline-offset-4 hover:underline" href="/credits">Créditos de imágenes</a></li>
          </ul>
        </div>
        <div className="space-y-5 md:col-span-2">
          <h4 className="font-semibold text-white">Noticias</h4>
          <p className="text-white/75">Recibe novedades y ofertas exclusivas.</p>
          <form aria-label="Suscripción al boletín" onSubmit={(e)=>{e.preventDefault(); const f=e.currentTarget; const input=f.querySelector('input'); if(input){ input.value=''; }}} className="flex flex-col gap-3 max-w-md">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="email" required placeholder="Tu email" className="flex-1 px-3 py-2 text-sm rounded-md bg-white/95 text-neutral-800 border border-white/15 placeholder-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60" />
              <button className="px-4 py-2 text-sm font-medium rounded-md bg-carrot text-nav hover:bg-carrot-dark transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Suscribirme</button>
            </div>
            <p className="text-[11px] text-white/50">Protegemos tus datos. Cancelar suscripción en cualquier momento.</p>
          </form>
        </div>
      </div>
      <div className="px-6 py-4 text-[11px] text-center text-white/55 bg-black/20 backdrop-blur-sm">Punto Hogar · Proyecto académico — Next.js, Prisma, PostgreSQL y Tailwind CSS</div>
    </footer>
  );
}
