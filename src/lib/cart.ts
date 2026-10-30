import { fetchWithTimeout, throwIfNotOk, ApiError } from './http';

export interface CartItem { productId: string; qty: number }
export interface EnrichedCartItem extends CartItem {
  name: string;
  price: number;
  lineTotal: number;
  slug?: string;
  imageUrl?: string | null;
  stock?: number; // existencias disponibles hoy
}
export interface CartData { items: CartItem[]; subtotal?: number; enriched?: EnrichedCartItem[]; issues?: string[] }

function notifyCartUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:updated'));
}

async function send(method: 'POST' | 'PUT' | 'DELETE', body: unknown, fallback: string): Promise<CartData> {
  const res = await fetchWithTimeout('/api/cart', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await throwIfNotOk(res, fallback);
  const data = await res.json();
  notifyCartUpdated();
  return data;
}

export async function getCart(): Promise<CartData> {
  const res = await fetchWithTimeout('/api/cart', { cache: 'no-store' });
  await throwIfNotOk(res, 'No se pudo obtener el carrito');
  return res.json();
}

// Los mensajes de error vienen del servidor (por ejemplo: "Solo hay 3 unidades disponibles de ...").
export const addToCart = (productId: string, qty: number = 1) => send('POST', { productId, qty }, 'No se pudo agregar al carrito');
export const updateItem = (productId: string, qty: number) => send('PUT', { productId, qty }, 'No se pudo actualizar la cantidad');
export const removeItem = (productId: string) => send('DELETE', { productId }, 'No se pudo eliminar el producto');

// Orders
export interface CreateOrderInput { customer: string; email: string; phone: string; address: string }

export class OrderError extends ApiError {
  fields: Record<string, string>;
  outOfStock: { productId: string; name: string; available: number; requested: number }[];
  constructor(base: ApiError) {
    super(base.message, base.status, base.code, base.data);
    this.fields = base.data?.fields || {};
    this.outOfStock = Array.isArray(base.data?.items) ? base.data.items : [];
  }
}

export async function createOrder(data: CreateOrderInput) {
  const res = await fetchWithTimeout('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  try {
    await throwIfNotOk(res, 'No se pudo crear el pedido');
  } catch (e) {
    throw e instanceof ApiError ? new OrderError(e) : e;
  }
  const order = await res.json();
  // El servidor limpia la cookie; aquí notificamos al cliente para refrescar cualquier UI dependiente
  notifyCartUpdated();
  return order;
}
