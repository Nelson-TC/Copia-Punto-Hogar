import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { serverErrorResponse } from '../../../../src/lib/db-errors';
import { publicProduct } from '../../../../src/lib/serialize';

export const dynamic = 'force-dynamic';

// GET /api/products/:slugOrId (público)
// Devuelve un único producto activo por slug o id (incluye stock disponible).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const key = decodeURIComponent(params.slug);

    const product = await prisma.product.findFirst({
      where: {
        active: true,
        OR: [ { slug: key }, { id: key } ]
      },
      include: { category: { select: { id: true, name: true, slug: true } } }
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Sin caché: la disponibilidad cambia con cada compra y debe verse de inmediato.
    const res = NextResponse.json(publicProduct(product));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    return serverErrorResponse('products.slug.GET', e, 'No se pudo consultar el producto.');
  }
}
