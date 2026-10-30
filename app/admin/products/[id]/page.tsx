import { prisma } from '@/lib/prisma';
import AdminProductForm from '../../../../components/AdminProductForm';
import { requirePagePermission } from '@/lib/guard';

interface Props { params: { id: string } }
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: Props) {
  const { user, allowed } = await requirePagePermission(['product:read','product:update']);
  if (!user) return <p className="text-sm text-red-600">No autenticado.</p>;
  if (!allowed) return <p className="text-sm text-red-600">No autorizado.</p>;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
  ]);
  if (!product) return <p className="text-sm text-neutral-600">Producto no encontrado.</p>;
  // Solo datos planos hacia el componente de cliente (el precio de Prisma es un Decimal y las fechas son Date).
  const initial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    price: Number(product.price),
    costPrice: Number(product.costPrice),
    stock: product.stock,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? '',
    active: product.active
  } as any;
  return (
    <div className="max-w-5xl">
      <AdminProductForm mode="edit" initial={initial} categories={categories} />
    </div>
  );
}
