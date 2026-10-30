// Validación de productos en el servidor. Se aplica aunque el frontend se omita
// (por ejemplo, una petición directa a la API con precio negativo o campos vacíos).

export const MAX_PRICE = 999999.99;
export const MAX_STOCK = 1000000;

export type ProductInput = {
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  categoryId: string;
  description: string | null;
};

export type ProductValidation =
  | { ok: true; value: ProductInput }
  | { ok: false; code: string; message: string; field: string };

export function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

/** Costo (ya incluye IVA): 0 o mayor (0 = costo aún no registrado). */
export function parseCost(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

export function parseStock(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_STOCK) return null;
  return n;
}

export function validateProductInput(raw: { name?: unknown; price?: unknown; costPrice?: unknown; stock?: unknown; categoryId?: unknown; description?: unknown }): ProductValidation {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length < 2) return { ok: false, code: 'NAME_REQUIRED', field: 'name', message: 'El nombre es obligatorio (mínimo 2 caracteres).' };
  if (name.length > 160) return { ok: false, code: 'NAME_TOO_LONG', field: 'name', message: 'El nombre no puede superar 160 caracteres.' };

  const price = parsePrice(raw.price);
  if (price === null) return { ok: false, code: 'INVALID_PRICE', field: 'price', message: 'El precio debe ser un número mayor a 0.' };

  const costPrice = parseCost(raw.costPrice);
  if (costPrice === null) return { ok: false, code: 'INVALID_COST', field: 'costPrice', message: 'El costo debe ser un número mayor o igual a 0.' };

  // Si no se envía existencia se interpreta como 0 (producto sin inventario todavía).
  const stock = raw.stock === undefined || raw.stock === null || String(raw.stock).trim() === '' ? 0 : parseStock(raw.stock);
  if (stock === null) return { ok: false, code: 'INVALID_STOCK', field: 'stock', message: 'El stock debe ser un número entero mayor o igual a 0.' };

  const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId.trim() : '';
  if (!categoryId) return { ok: false, code: 'CATEGORY_REQUIRED', field: 'categoryId', message: 'La categoría es obligatoria.' };

  const description = typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null;
  return { ok: true, value: { name, price, costPrice, stock, categoryId, description } };
}
