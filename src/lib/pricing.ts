// Cálculos de costo, margen y precio de venta. Se usa en el servidor y en el formulario del administrador,
// así ambos calculan exactamente lo mismo.
//
// Convenciones:
//  - El COSTO ya incluye IVA, y el PRECIO DE VENTA también: no hay que calcular ni separar el IVA.
//  - Ganancia por unidad = precio de venta - costo.
//  - MARGEN DE GANANCIA (porcentaje sobre el precio de venta) = (precio - costo) / precio.
//  - Por eso el precio se obtiene así:  precio = costo / (1 - margen)
//    Ejemplo: costo Q70 con margen 30 % -> precio = 70 / (1 - 0.30) = Q100.

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Ganancia por unidad = precio de venta - costo. */
export function profitPerUnit(price: number, cost: number): number {
  return round2(price - cost);
}

/** Margen de ganancia en porcentaje: (precio - costo) / precio. Null si falta el costo o el precio. */
export function marginPct(price: number, cost: number): number | null {
  if (!(cost > 0) || !(price > 0)) return null;
  return round2(((price - cost) / price) * 100);
}

/** Precio de venta que deja el margen indicado: costo / (1 - margen). Null si el margen no es válido (>= 100 %). */
export function priceFromMargin(cost: number, margin: number): number | null {
  if (!(cost > 0) || !Number.isFinite(margin) || margin >= 100) return null;
  return round2(cost / (1 - margin / 100));
}
