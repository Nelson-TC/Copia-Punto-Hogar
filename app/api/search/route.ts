import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serverErrorResponse } from '@/lib/db-errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ items: [] });
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    const items = await prisma.product.findMany({
      where: {
        active: true, // los productos inactivos no se muestran al cliente
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, slug: true, imageUrl: true, price: true, stock: true },
      take: 8,
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ items });
  } catch (e:any) {
    const res = serverErrorResponse('search.GET', e, 'No se pudo realizar la búsqueda.');
    return NextResponse.json({ items: [], ...(await res.json()) }, { status: res.status });
  }
}
