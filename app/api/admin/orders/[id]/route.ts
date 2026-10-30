import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/lib/prisma';
import { requirePermission } from '../../../../../src/lib/permissions';
import { logAudit } from '../../../../../src/lib/audit';
import { serverErrorResponse } from '../../../../../src/lib/db-errors';

function err(status: number, code: string, message?: string) { return NextResponse.json({ error: message || code, code }, { status }); }

interface Params { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
  try {
    await requirePermission('order:read');
    const order = await prisma.order.findUnique({ where: { id: params.id }, include: { items: true, user: { select: { id: true, email: true } } } });
    if (!order) return err(404,'NOT_FOUND');
    const items = order.items.map(it => ({
      productName: it.name,
      productSlug: it.slug,
      productId: it.productId,
      qty: it.quantity,
      unitPrice: it.unitPrice,
      total: (it.quantity * Number(it.unitPrice))
    }));
    return NextResponse.json({
      id: order.id,
      status: order.status,
      customerName: order.customer,
      customerEmail: order.email,
      customerPhone: order.phone,
      customerAddress: order.address,
      subtotal: order.subtotal,
      total: order.total,
      createdAt: order.createdAt,
      userEmail: (order as any).user?.email || null,
      items
    });
  } catch (e:any) {
    if (e instanceof Error) {
      if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
      if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
    }
    return err(500,'SERVER_ERROR');
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requirePermission('order:manageStatus');
    const body = await req.json().catch(()=>({}));
    const nextStatusRaw = String(body.status || '').toUpperCase();
    const allowed = ['PENDING','PAID','SHIPPED','COMPLETED','CANCELED'];
    if (!allowed.includes(nextStatusRaw)) return err(400,'INVALID_STATUS');
    const existing = await prisma.order.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!existing) return err(404,'NOT_FOUND');
    if (existing.status === nextStatusRaw) return NextResponse.json({ ok: true, unchanged: true });
    // Un pedido cancelado ya devolvió su inventario; reactivarlo dejaría el stock inconsistente.
    if (existing.status === 'CANCELED') return err(409,'ORDER_CANCELED','Un pedido cancelado no puede cambiar de estado.');

    // El cambio de estado y la devolución de inventario ocurren juntos (transacción atómica).
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.order.update({ where: { id: params.id }, data: { status: nextStatusRaw as any }, select: { status: true } });
      if (nextStatusRaw === 'CANCELED') {
        const items = await tx.orderItem.findMany({ where: { orderId: params.id }, select: { productId: true, quantity: true } });
        for (const it of items) {
          await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
        }
      }
      return row;
    });
    logAudit('order.status.update','Order', params.id, { from: existing.status, to: updated.status });
    return NextResponse.json({ ok: true, from: existing.status, to: updated.status });
  } catch (e:any) {
    if (e instanceof Error) {
      if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
      if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
    }
    return serverErrorResponse('admin.orders.PATCH', e);
  }
}

export async function PUT(req: Request, ctx: Params) {
  // alias for PATCH to support mobile contract
  return PATCH(req, ctx);
}
