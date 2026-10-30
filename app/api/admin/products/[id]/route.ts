import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/lib/prisma';
import { requirePermission } from '../../../../../src/lib/permissions';
import { FALLBACK_IMAGE, saveUploadedFile, slugify, deleteIfLocal } from '../../../../../src/lib/uploads';
import { logAudit } from '../../../../../src/lib/audit';
import { parseStock, validateProductInput } from '../../../../../src/lib/product-validation';
import { isForeignKeyViolation, isUniqueViolation, serverErrorResponse } from '../../../../../src/lib/db-errors';

export const runtime = 'nodejs';

function err(status: number, code: string, message?: string) { return NextResponse.json({ error: message || code, code }, { status }); }

interface Params { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
	try {
		await requirePermission('product:read');
		const product = await prisma.product.findUnique({ where: { id: params.id } });
		if (!product) return err(404,'NOT_FOUND');
		return NextResponse.json(product);
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return err(500,'SERVER_ERROR');
	}
}

export async function PUT(req: Request, { params }: Params) {
	try {
		await requirePermission('product:update');
		const contentType = req.headers.get('content-type') || '';
		let raw: { name?: unknown; price?: unknown; costPrice?: unknown; stock?: unknown; categoryId?: unknown; description?: unknown } = {};
		let active: any = true;
		let imageUrl: string | null | undefined = undefined; // undefined keep, null remove, string set
		let file: File | null = null;

		if (contentType.includes('multipart/form-data')) {
			const form = await req.formData();
			raw = { name: form.get('name'), price: form.get('price'), costPrice: form.get('costPrice'), stock: form.get('stock'), categoryId: form.get('categoryId'), description: form.get('description') };
			active = String(form.get('active') || 'true') === 'true';
			const removeFlag = form.get('removeImage');
			if (removeFlag === 'true') imageUrl = null;
			const f = form.get('image');
			if (f instanceof File && f.size > 0) file = f;
		} else {
			const body = await req.json().catch(() => null);
			if (!body || typeof body !== 'object') return err(400,'MISSING_FIELDS','Faltan campos obligatorios.');
			raw = body;
			active = body.active ?? true;
			imageUrl = body.imageUrl; // could be undefined/null/string
		}

		const parsed = validateProductInput(raw);
		if (!parsed.ok) return err(400, parsed.code, parsed.message);
		const { name, price: numericPrice, costPrice, stock, categoryId, description } = parsed.value;
		const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
		if (!category) return err(400,'CATEGORY_REQUIRED','La categoría seleccionada no existe.');
		const slug = slugify(name);

		const existing = await prisma.product.findUnique({ where: { id: params.id }, select: { imageUrl: true } });
		if (!existing) return err(404,'NOT_FOUND');

		let finalImage = existing.imageUrl || FALLBACK_IMAGE;
		let oldImageToDelete: string | null = null;

		if (file) {
			try {
				const saved = await saveUploadedFile(file,'items', slug);
				if (existing.imageUrl && existing.imageUrl !== FALLBACK_IMAGE) oldImageToDelete = existing.imageUrl;
				finalImage = saved.relativePath;
			} catch (uploadErr: any) {
				if (uploadErr instanceof Error) {
					if (uploadErr.message === 'FILE_TOO_LARGE') return err(400,'FILE_TOO_LARGE');
					if (uploadErr.message === 'INVALID_MIME') return err(400,'INVALID_MIME');
					if (uploadErr.message === 'INVALID_EXT') return err(400,'INVALID_EXT');
				}
				return err(500,'UPLOAD_FAILED');
			}
		} else if (imageUrl === null) {
			if (existing.imageUrl && existing.imageUrl !== FALLBACK_IMAGE) oldImageToDelete = existing.imageUrl;
			finalImage = FALLBACK_IMAGE;
		}
		// if imageUrl undefined -> keep existing, if string provided (not handled separately) future branch could set explicit URL

		const product = await prisma.product.update({ where: { id: params.id }, data: { name, slug, price: numericPrice, costPrice, stock, description, categoryId, active, imageUrl: finalImage } });
		logAudit('product.update','Product', product.id, { name, stock, costPrice });
		if (oldImageToDelete) deleteIfLocal(oldImageToDelete);
		return NextResponse.json(product);
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'DUPLICATE','Ya existe un producto con ese nombre. Usa un nombre distinto.');
		return serverErrorResponse('admin.products.PUT', e, 'Error al actualizar el producto.');
	}
}

// PATCH /api/admin/products/:id  { stock: number }
// Actualización rápida de existencias desde el listado (RF10). El producto con stock 0 deja de poder comprarse.
export async function PATCH(req: Request, { params }: Params) {
	try {
		await requirePermission('product:update');
		const body = await req.json().catch(() => null);
		const stock = parseStock(body?.stock);
		if (stock === null) return err(400,'INVALID_STOCK');
		const existing = await prisma.product.findUnique({ where: { id: params.id }, select: { stock: true } });
		if (!existing) return err(404,'NOT_FOUND');
		const product = await prisma.product.update({ where: { id: params.id }, data: { stock }, select: { id: true, stock: true } });
		logAudit('product.stock.update','Product', params.id, { from: existing.stock, to: stock });
		return NextResponse.json(product);
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return serverErrorResponse('admin.products.PATCH', e, 'Error al actualizar el stock.');
	}
}

export async function DELETE(_: Request, { params }: Params) {
	try {
		await requirePermission('product:delete');
		const existing = await prisma.product.findUnique({ where: { id: params.id }, select: { imageUrl: true } });
		if (!existing) return err(404,'NOT_FOUND');
		// Los productos que ya se vendieron conservan su historial: se desactivan en lugar de borrarse.
		const sold = await prisma.orderItem.count({ where: { productId: params.id } });
		if (sold > 0) return err(409,'PRODUCT_HAS_ORDERS','Este producto tiene pedidos asociados y no puede eliminarse. Desactívalo para ocultarlo del catálogo.');
		await prisma.product.delete({ where: { id: params.id } });
		logAudit('product.delete','Product', params.id);
		if (existing.imageUrl && existing.imageUrl !== FALLBACK_IMAGE) deleteIfLocal(existing.imageUrl);
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		// Los productos que ya se vendieron conservan su historial: se desactivan en lugar de borrarse.
		if (isForeignKeyViolation(e)) return err(409,'PRODUCT_HAS_ORDERS','Este producto tiene pedidos asociados y no puede eliminarse. Desactívalo para ocultarlo del catálogo.');
		return serverErrorResponse('admin.products.DELETE', e, 'Error al eliminar el producto.');
	}
}
