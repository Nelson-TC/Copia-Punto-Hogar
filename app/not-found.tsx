import Link from 'next/link';

// Se muestra cuando una ruta no existe o cuando se pide algo que el cliente no puede ver
// (por ejemplo, un producto inactivo).
export default function NotFound() {
  return (
    <div className="max-w-xl px-4 py-20 mx-auto space-y-6 text-center">
      <p className="text-6xl font-extrabold text-carrot">404</p>
      <h1 className="text-2xl font-bold tracking-tight">No encontramos esa página</h1>
      <p className="text-sm text-neutral-600">El enlace puede estar roto o el producto ya no está disponible en el catálogo.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/products" className="px-5 py-2.5 text-sm font-semibold rounded-full bg-carrot text-nav hover:bg-carrot-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Ver productos</Link>
        <Link href="/" className="px-5 py-2.5 text-sm font-medium border rounded-full border-neutral-300 hover:bg-neutral-100">Ir al inicio</Link>
      </div>
    </div>
  );
}
