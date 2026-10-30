// Los componentes de cliente solo pueden recibir objetos planos: Prisma devuelve el precio como Decimal,
// así que se convierte a número antes de pasarlo a <ProductCard /> (evita la advertencia de React).
//
// SEGURIDAD: el costo de compra es información interna. Se elimina aquí para que nunca viaje al navegador
// del cliente (ni en el HTML de las páginas ni en las respuestas de la API pública).
export function plainProduct<T extends { price: any }>(p: T): Omit<T, 'price' | 'costPrice'> & { price: number } {
  const { costPrice: _cost, ...rest } = p as any;
  return { ...rest, price: Number(p.price) };
}

/** Producto tal como se publica en la API pública: igual que en BD pero sin el costo. */
export function publicProduct<T extends Record<string, any>>(p: T): Omit<T, 'costPrice'> {
  const { costPrice: _cost, ...rest } = p;
  return rest;
}
