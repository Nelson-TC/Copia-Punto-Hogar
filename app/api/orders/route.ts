import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { serverErrorResponse } from '@/lib/db-errors';

export const dynamic = 'force-dynamic';

const CART_COOKIE = 'cart';

function readCart(): { items: { productId: string; qty: number }[] } {
	const raw = cookies().get(CART_COOKIE)?.value;
	if (!raw) return { items: [] };
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed.items)) {
			return { items: parsed.items.filter((i: any) => i && typeof i.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0) };
		}
		return { items: [] };
	} catch { return { items: [] }; }
}

function clearCart() {
	cookies().set(CART_COOKIE, JSON.stringify({ items: [] }), { path: '/', httpOnly: false, sameSite: 'lax' });
}

function json(body: unknown, status: number) {
	return NextResponse.json(body, { status });
}

/** Se lanza dentro de la transacción para revertirla completa cuando falta inventario. */
class OutOfStockError extends Error {
	items: { productId: string; name: string; available: number; requested: number }[];
	constructor(items: OutOfStockError['items']) {
		super('OUT_OF_STOCK');
		this.items = items;
	}
}

// POST /api/orders
// Registra el pedido del cliente autenticado y descuenta el inventario en UNA sola transacción:
// si algún producto no tiene existencias suficientes no se crea el pedido ni se descuenta nada.
export async function POST(req: NextRequest) {
	try {
		const session = await getSession();
		if (!session?.sub) return json({ error: 'Debes iniciar sesión para confirmar un pedido.', code: 'UNAUTHENTICATED' }, 401);

		const body = await req.json().catch(() => null) as any;
		const errors: Record<string, string> = {};
		function reqField(field: string, min = 1) {
			const v = body?.[field];
			if (typeof v !== 'string' || v.trim().length < min) errors[field] = `Requerido (mínimo ${min} caracteres)`;
			return typeof v === 'string' ? v.trim() : undefined;
		}
		const customer = reqField('customer', 2);
		const email = reqField('email', 5);
		const phone = reqField('phone', 5);
		const address = reqField('address', 5);
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Correo electrónico inválido';
		if (phone && !/^[+0-9 ()-]{5,}$/.test(phone)) errors.phone = 'Teléfono inválido';
		if (Object.keys(errors).length) return json({ error: 'Revisa los datos de envío.', code: 'VALIDATION', fields: errors }, 422);

		const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true } });
		if (!user) return json({ error: 'Tu sesión ya no es válida. Inicia sesión nuevamente.', code: 'UNAUTHENTICATED' }, 401);

		// Cantidades por producto (si el mismo producto viniera repetido se acumulan).
		const cart = readCart();
		const wanted = new Map<string, number>();
		for (const i of cart.items) wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.qty);
		if (wanted.size === 0) return json({ error: 'Tu carrito está vacío.', code: 'EMPTY_CART' }, 400);

		const order = await prisma.$transaction(async (tx) => {
			const products = await tx.product.findMany({
				where: { id: { in: Array.from(wanted.keys()) } },
				select: { id: true, name: true, slug: true, price: true, costPrice: true, active: true, stock: true }
			});
			const byId = new Map(products.map(p => [p.id, p]));
			const problems: OutOfStockError['items'] = [];
			const lines: { productId: string; name: string; slug: string; unitPrice: number; unitCost: number; quantity: number }[] = [];

			for (const [productId, quantity] of Array.from(wanted.entries())) {
				const p = byId.get(productId);
				if (!p || !p.active) {
					problems.push({ productId, name: p?.name ?? 'Producto no disponible', available: 0, requested: quantity });
					continue;
				}
				// Descuento condicional: solo se aplica si todavía hay existencias suficientes.
				// Así dos clientes comprando al mismo tiempo nunca dejan el stock en negativo.
				const updated = await tx.product.updateMany({
					where: { id: productId, active: true, stock: { gte: quantity } },
					data: { stock: { decrement: quantity } }
				});
				if (updated.count === 0) {
					const fresh = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
					problems.push({ productId, name: p.name, available: fresh?.stock ?? 0, requested: quantity });
					continue;
				}
				// El precio aplicado es el vigente al momento de la compra.
				// y el costo vigente, para poder calcular la ganancia real aunque el costo cambie después.
				lines.push({ productId, name: p.name, slug: p.slug, unitPrice: Number(p.price), unitCost: Number(p.costPrice), quantity });
			}
			if (problems.length) throw new OutOfStockError(problems);

			const subtotal = Number(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0).toFixed(2));
			const total = subtotal; // los precios publicados ya incluyen IVA
			return tx.order.create({
				data: {
					customer: customer!,
					email: email!,
					address: address!,
					phone: phone!,
					subtotal,
					total,
					userId: user.id,
					items: { create: lines }
				},
				include: { items: true }
			});
		}, { timeout: 15000, maxWait: 10000 });

		clearCart();
		// El costo es información interna: no se incluye en la respuesta al cliente.
		return json({ ...order, items: order.items.map(({ unitCost: _c, ...item }) => item) }, 201);
	} catch (e: any) {
		if (e instanceof OutOfStockError) {
			const detail = e.items.map(i => i.available === 0 ? `"${i.name}" está agotado` : `de "${i.name}" solo hay ${i.available}`).join('; ');
			return json({
				error: `No se pudo confirmar el pedido: ${detail}. No se descontó inventario; ajusta tu carrito e intenta de nuevo.`,
				code: 'OUT_OF_STOCK',
				items: e.items
			}, 409);
		}
		return serverErrorResponse('orders.POST', e, 'No se pudo crear el pedido. Intenta más tarde.');
	}
}
