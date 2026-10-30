import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../src/lib/prisma';
import { serverErrorResponse } from '../../../src/lib/db-errors';

// Carrito guardado como JSON en una cookie: { items: [{ productId: string; qty: number }] }
// El stock se valida siempre contra la base de datos (regla de negocio: no superar la existencia).

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'cart';
interface CartItem { productId: string; qty: number }
interface CartData { items: CartItem[] }
const MAX_ITEMS = 100; // cantidad total máxima en el carrito
const MAX_PER_ITEM = 50;

function fail(status: number, code: string, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, code, ...extra }, { status });
}

function readCart(): CartData {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) {
      return { items: parsed.items.filter((i: any) => i && typeof i.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0) };
    }
    return { items: [] };
  } catch { return { items: [] }; }
}

function writeCart(cart: CartData) {
  cookies().set(COOKIE_NAME, JSON.stringify(cart), { path: '/', httpOnly: false, sameSite: 'lax' });
}

async function cartPayload() {
  const cart = readCart();
  if (cart.items.length === 0) {
    return { items: [], subtotal: 0, enriched: [], issues: [] as string[] };
  }
  const products = await prisma.product.findMany({
    where: { id: { in: cart.items.map(i => i.productId) } },
    select: { id: true, name: true, price: true, slug: true, imageUrl: true, stock: true, active: true }
  });
  const map = new Map(products.map(p => [p.id, p]));
  const issues: string[] = [];
  const enriched = cart.items
    .filter(i => map.has(i.productId))
    .map(i => {
      const p = map.get(i.productId)!;
      const price = Number(p.price);
      const available = p.active ? p.stock : 0;
      if (available < i.qty) {
        issues.push(available === 0
          ? `"${p.name}" está agotado.`
          : `De "${p.name}" solo hay ${available} unidad${available === 1 ? '' : 'es'} disponible${available === 1 ? '' : 's'}.`);
      }
      return { ...i, name: p.name, price, lineTotal: price * i.qty, slug: p.slug, imageUrl: p.imageUrl, stock: available };
    });
  const subtotal = enriched.reduce((s, i) => s + i.lineTotal, 0);
  return { items: cart.items, enriched, subtotal, issues };
}

export async function GET() {
  try {
    return NextResponse.json(await cartPayload());
  } catch (e) {
    return serverErrorResponse('cart.GET', e);
  }
}

/** Verifica que el producto exista, esté activo y alcance el stock para la cantidad pedida. */
async function checkAvailability(productId: string, desiredQty: number) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, stock: true, active: true } });
  if (!product || !product.active) return { ok: false as const, res: fail(404, 'NOT_FOUND', 'El producto no está disponible.') };
  if (product.stock <= 0) return { ok: false as const, res: fail(409, 'OUT_OF_STOCK', `"${product.name}" está agotado.`, { available: 0 }) };
  if (desiredQty > product.stock) {
    return { ok: false as const, res: fail(409, 'STOCK_EXCEEDED', `Solo hay ${product.stock} unidad${product.stock === 1 ? '' : 'es'} disponible${product.stock === 1 ? '' : 's'} de "${product.name}".`, { available: product.stock }) };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Partial<CartItem> | null;
    if (!body?.productId || typeof body.productId !== 'string' || !Number.isInteger(body.qty) || (body.qty as number) < 1) {
      return fail(400, 'INVALID_DATA', 'Datos inválidos: la cantidad debe ser un entero mayor a 0.');
    }
    const qty = body.qty as number;
    const cart = readCart();
    const existing = cart.items.find(i => i.productId === body.productId);
    const desired = (existing?.qty ?? 0) + qty;
    if (desired > MAX_PER_ITEM) return fail(400, 'LIMIT_PER_ITEM', `Máximo ${MAX_PER_ITEM} unidades por producto.`);
    const check = await checkAvailability(body.productId, desired);
    if (!check.ok) return check.res;
    if (existing) existing.qty = desired; else cart.items.push({ productId: body.productId, qty });
    const totalQty = cart.items.reduce((s, i) => s + i.qty, 0);
    if (totalQty > MAX_ITEMS) return fail(400, 'LIMIT_TOTAL', 'Límite total del carrito superado.');
    writeCart(cart);
    return NextResponse.json(await cartPayload());
  } catch (e) {
    return serverErrorResponse('cart.POST', e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Partial<CartItem> | null;
    if (!body?.productId || typeof body.productId !== 'string' || !Number.isInteger(body.qty) || (body.qty as number) < 0) {
      return fail(400, 'INVALID_DATA', 'Datos inválidos: la cantidad debe ser un entero mayor o igual a 0.');
    }
    const qty = body.qty as number;
    const cart = readCart();
    const idx = cart.items.findIndex(i => i.productId === body.productId);
    if (idx === -1) return fail(404, 'NOT_FOUND', 'El producto no está en el carrito.');
    if (qty === 0) {
      cart.items.splice(idx, 1);
    } else {
      if (qty > MAX_PER_ITEM) return fail(400, 'LIMIT_PER_ITEM', `Máximo ${MAX_PER_ITEM} unidades por producto.`);
      const check = await checkAvailability(body.productId, qty);
      if (!check.ok) return check.res;
      cart.items[idx].qty = qty;
    }
    const totalQty = cart.items.reduce((s, i) => s + i.qty, 0);
    if (totalQty > MAX_ITEMS) return fail(400, 'LIMIT_TOTAL', 'Límite total del carrito superado.');
    writeCart(cart);
    return NextResponse.json(await cartPayload());
  } catch (e) {
    return serverErrorResponse('cart.PUT', e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Partial<CartItem> | null;
    if (!body?.productId) return fail(400, 'INVALID_DATA', 'Datos inválidos.');
    const cart = readCart();
    writeCart({ items: cart.items.filter(i => i.productId !== body.productId) });
    return NextResponse.json(await cartPayload());
  } catch (e) {
    return serverErrorResponse('cart.DELETE', e);
  }
}
