import { notFound } from 'next/navigation';
import { prisma } from '../../../src/lib/prisma';
import { formatCurrency } from '../../../src/lib/format';
import Image from 'next/image';
import Link from 'next/link';
import ProductPurchasePanel from '../../../components/ProductPurchasePanel';

interface Props { params: { slug: string } }

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: Props) {
	const product = await prisma.product.findUnique({ where: { slug: params.slug }, include: { category: true } });
	// Regla de negocio: un producto inactivo no se muestra al cliente aunque tenga existencias.
	if (!product || !product.active) return notFound();

	const priceNumber = Number(product.price);

	return (
		<div className="max-w-6xl px-5 mx-auto">
			{/* Breadcrumbs */}
			<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 mb-6 text-xs text-neutral-500">
				<Link href="/" className="transition hover:text-neutral-700">Inicio</Link>
				<span>/</span>
				<Link href="/products" className="transition hover:text-neutral-700">Productos</Link>
				{product.category && (<>
					<span>/</span>
					<Link href={`/categories/${product.category.slug}`} className="transition hover:text-neutral-700">{product.category.name}</Link>
				</>)}
				<span>/</span>
				<span className="text-neutral-700 font-medium line-clamp-1 max-w-[240px] md:max-w-none">{product.name}</span>
			</nav>

			<div className="grid gap-12 md:grid-cols-2">
				{/* Image / Media */}
				<div className="space-y-4">
					<div className="relative overflow-hidden border shadow-sm aspect-square rounded-2xl bg-neutral-50 border-neutral-200">
						{product.imageUrl ? (
							<Image
								src={product.imageUrl}
								alt={product.name}
								fill
								priority={false}
								className="object-cover"
							/>
						) : (
							<div className="flex items-center justify-center w-full h-full text-xs tracking-wider select-none text-neutral-400">SIN IMAGEN</div>
						)}
						{product.category && (
							<span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-black/5">
								<i className='text-sm bx bxs-tag-alt text-carrot' /> {product.category.name}
							</span>
						)}
					</div>
					{/* Potential future thumbnails area - left as placeholder */}
				</div>
				{/* Info / Purchase */}
				<div className="flex flex-col gap-10">
					<header className="space-y-5">
						<h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl text-neutral-900">{product.name}</h1>
						{product.description && (
							<p className="text-sm leading-relaxed whitespace-pre-line text-neutral-700 max-w-prose">{product.description}</p>
						)}
					</header>
					<ProductPurchasePanel productId={product.id} productName={product.name} priceFormatted={formatCurrency(priceNumber)} stock={product.stock} />
					<section aria-label="Detalles" className="space-y-3">
						<h2 className="text-sm font-semibold tracking-wide text-neutral-800">Información</h2>
						<ul className="text-[12px] text-neutral-600 space-y-1">
							{product.category && <li><strong className="font-medium text-neutral-700">Categoría:</strong> {product.category.name}</li>}
							<li><strong className="font-medium text-neutral-700">Disponibilidad:</strong> {product.stock > 0 ? `${product.stock} en existencia` : 'Agotado'}</li>
						</ul>
					</section>
				</div>
			</div>
		</div>
	);
}
