import { prisma } from '../src/lib/prisma';
import ProductCard from '../components/ProductCard';
import Image from 'next/image';
import NewsletterForm from '../components/NewsletterForm';
import { plainProduct } from '../src/lib/serialize';

// Podríamos optar por ISR, pero mientras tanto mantenemos dinámico para reflejar cambios inmediatos.
export const dynamic = 'force-dynamic';

async function getFeaturedProducts() {
  try {
    const rows = await prisma.product.findMany({
      where: { active: true, stock: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { category: { select: { name: true } } }
    });
    return rows.map(plainProduct);
  } catch {
    return [];
  }
}

async function getTopCategories() {
  try {
    return await prisma.category.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      take: 4
    });
  } catch {
    return [];
  }
}

// Fallbacks locales para imágenes de categorías si no hay imageUrl.
const categoryImageFallback: Record<string, string> = {
  'hogar-y-decoracion': '/images/categories/hogar-y-decoracion.svg',
  cocina: '/images/categories/cocina.svg',
  dormitorio: '/images/categories/dormitorio.svg',
  bano: '/images/categories/bano.svg',
  limpieza: '/images/categories/limpieza.svg',
  'ferreteria-y-herramientas': '/images/categories/ferreteria-y-herramientas.svg',
  iluminacion: '/images/categories/iluminacion.svg',
  jardin: '/images/categories/jardin.svg',
  'organizacion-y-almacenamiento': '/images/categories/organizacion-y-almacenamiento.svg',
  'productos-para-ninos-y-regalos': '/images/categories/productos-para-ninos-y-regalos.svg'
};

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getFeaturedProducts(),
    getTopCategories()
  ]);

  return (
    <main className="space-y-28">
      {/* HERO (New Transparent Layered Design) */}
      <section aria-labelledby="hero-heading" className="relative px-6 pb-6 overflow-hidden md:m-0 rounded-xl">
        {/* Fondo limpio: blanco a gris azulado muy claro, con un borde sutil */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-10 rounded-xl border border-nav/10 bg-gradient-to-br from-white via-surface-alt to-[#E3EBF4]" />
        <div aria-hidden="true" className="absolute top-0 right-0 w-1/2 h-full pointer-events-none -z-10 rounded-r-xl bg-[radial-gradient(circle_at_70%_40%,rgba(18,52,83,0.06),transparent_65%)]" />

        <div className="relative grid items-center max-w-6xl mx-auto md:grid-cols-2 gap-14 lg:gap-20">
          {/* Left content */}
          <div className="relative space-y-9">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 text-[11px] font-medium tracking-wide rounded-full bg-white text-nav ring-1 ring-nav/15 shadow-sm">
                <i className='bx bxs-home-heart text-[13px] text-carrot' /> Tu tienda por departamentos en línea
              </span>
              <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-nav">
                Todo para
                <span className="relative inline-block mx-2">
                  <span className="absolute inset-x-0 h-2 rounded-full -bottom-0.5 bg-carrot" />
                  <span className="relative">tu hogar</span>
                </span>
                en un solo lugar
              </h1>
              <p className="text-base leading-relaxed sm:text-lg max-w-prose text-ink/80">
                Decoración, cocina, ferretería, iluminación, jardín y mucho más. Encuentra artículos para el hogar y de uso cotidiano, con envío a todo el país.
              </p>
            </div>
            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <a href="/products" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition rounded-full shadow-sm group bg-carrot text-nav hover:bg-carrot-dark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/70">
                Ver catálogo <i className='bx bx-right-arrow-alt text-base transition -mr-1 group-hover:translate-x-0.5' />
              </a>
              <a href="#categorias" className="px-6 py-3 text-sm font-medium transition border rounded-full border-nav/25 text-nav bg-white hover:bg-nav hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">
                Explorar categorías
              </a>
            </div>
            {/* Value mini list */}
            <ul className="flex flex-wrap pt-2 text-xs gap-x-8 gap-y-4 text-ink/80">
              <li className="flex items-center gap-2"><i className='text-base bx bxs-package text-carrot' /> Amplio catálogo</li>
              <li className="flex items-center gap-2"><i className='text-base bx bxs-truck text-carrot' /> Envío rápido</li>
              <li className="flex items-center gap-2"><i className='text-base bx bxs-shield text-carrot' /> Pago seguro</li>
            </ul>
          </div>
          {/* Right visual card */}
          <div className="relative hidden md:block">
            <div className="relative w-full max-w-md mx-auto aspect-square">
              {/* Glass panel card */}
              <div className="absolute inset-0 rounded-3xl bg-white ring-1 ring-nav/10 shadow-[0_12px_40px_-12px_rgba(18,52,83,0.25)]" />
              <div className="relative flex items-center justify-center h-full rounded-3xl">
                <div className="relative flex items-center justify-center w-full h-full">
                  <Image src="/images/logo.webp" alt="Logotipo Punto Hogar: todo para tu hogar" fill sizes="(max-width: 768px) 80vw, 448px" className="object-contain p-8" priority />
                </div>
              </div>
              {/* Detalles decorativos en los colores de la marca */}
              <div aria-hidden className="absolute w-24 h-24 -bottom-5 -left-5 rounded-2xl bg-nav/90" />
              <div aria-hidden className="absolute w-14 h-14 -top-4 -right-4 rounded-xl bg-carrot" />
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS DESTACADAS */}
      <section id="categorias" aria-labelledby="cat-heading" className="px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="cat-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Categorías para empezar</h2>
            <a href="/categories" className="px-3 py-1 text-sm font-semibold text-nav transition-colors rounded bg-carrot hover:bg-carrot-dark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Ver todas →</a>
          </div>
          {categories.length === 0 && (
            <div className="text-sm text-neutral-500">Aún no hay categorías activas.</div>
          )}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
            {categories.map(c => {
              const img = c.imageUrl || categoryImageFallback[c.slug] || '/images/noimage.webp';
              return (
                <a key={c.id} href={`/categories/${c.slug}`} className="overflow-hidden transition bg-white border shadow-sm group rounded-xl border-nav/10 hover:border-carrot/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={c.name} className="object-cover w-full h-36" loading="lazy" />
                  <div className="flex items-center justify-between p-3 border-t border-nav/5">
                    <h3 className="text-sm font-semibold tracking-wide text-nav">{c.name}</h3>
                    <i className="text-lg transition bx bx-right-arrow-alt text-carrot group-hover:translate-x-0.5" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      <section id="productos" aria-labelledby="prod-heading" className="px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="prod-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Productos destacados</h2>
            <a href="/products" className="px-3 py-1 text-sm font-semibold text-nav transition-colors rounded bg-carrot hover:bg-carrot-dark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Ver catálogo completo →</a>
          </div>
          {products.length === 0 && (
            <div className="text-sm text-neutral-500">No hay productos disponibles todavía.</div>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5">
            {products.map((p: any) => <ProductCard key={p.id} product={p} variant="compact" />)}
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section aria-labelledby="val-heading" className="px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <h2 id="val-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Por qué elegirnos</h2>
          <div className="grid gap-6 md:grid-cols-4 sm:grid-cols-2">
            {[
              { icon: 'bxs-category', title: 'Todo en un solo lugar', desc: 'Diez categorías con artículos para cada rincón de la casa.' },
              { icon: 'bxs-package', title: 'Existencias en tiempo real', desc: 'Ves la disponibilidad real de cada producto antes de comprar.' },
              { icon: 'bxs-truck', title: 'Envío ágil', desc: 'Procesamos y enviamos tus pedidos rápidamente.' },
              { icon: 'bxs-shield', title: 'Compra segura', desc: 'Tu cuenta y tus datos protegidos con cifrado y acceso por rol.' }
            ].map(v => (
              <div key={v.title} className="relative flex flex-col gap-3 p-5 bg-white border shadow-sm rounded-xl border-neutral-200">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-carrot/15 text-carrot">
                  <i className={`bx ${v.icon} text-xl`} />
                </div>
                <h3 className="text-sm font-semibold tracking-wide">{v.title}</h3>
                <p className="text-xs leading-relaxed text-neutral-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANNER CTA */}
      <section aria-labelledby="cta-heading" className="px-6">
        <div className="relative max-w-6xl mx-auto overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-nav" />
          <div className="relative flex flex-col items-center gap-10 px-8 py-14 md:py-16 md:flex-row text-white">
            <div className="max-w-xl space-y-5">
              <h2 id="cta-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Renueva tu hogar sin salir de casa</h2>
              <p className="text-sm sm:text-base text-white/80 max-w-prose">Suscríbete y recibe ofertas, lanzamientos e ideas para decorar y organizar tu hogar.</p>
              <a href="#newsletter" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-nav transition rounded-full bg-carrot hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                Recibir novedades <i className='text-base bx bx-right-arrow-alt' />
              </a>
            </div>
            <div className="relative hidden w-full max-w-xs aspect-square sm:block">
              <div className="absolute inset-0 border rounded-3xl border-nav/20 bg-white/10 backdrop-blur" />
              <Image src="/images/categories/hogar-y-decoracion.svg" alt="Hogar y decoración" fill className="object-cover rounded-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section id="newsletter" aria-labelledby="news-heading" className="px-6 pb-10">
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <h2 id="news-heading" className="text-2xl font-semibold tracking-tight md:text-3xl">Mantente al día</h2>
            <p className="mx-auto text-sm text-neutral-600 max-w-prose">Promociones exclusivas, lanzamientos y consejos para tu hogar. Sin spam.</p>
          </div>
          <NewsletterForm />
          <p className="text-[11px] text-neutral-500">Puedes cancelar la suscripción en cualquier momento.</p>
        </div>
      </section>
    </main>
  );
}
