import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/lib/prisma';
import { requirePermission } from '../../../../../src/lib/permissions';
import { FALLBACK_IMAGE, saveUploadedFile, slugify, deleteIfLocal } from '../../../../../src/lib/uploads';
import { logAudit } from '../../../../../src/lib/audit';
import { isUniqueViolation, serverErrorResponse } from '../../../../../src/lib/db-errors';

export const runtime = 'nodejs';

function err(status: number, code: string, message?: string) {
  return NextResponse.json({ error: message || code, code }, { status });
}

interface Params { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
	try {
		await requirePermission('category:read');
		const category = await prisma.category.findUnique({ where: { id: params.id } });
		if (!category) return err(404,'NOT_FOUND','Not found');
		return NextResponse.json(category);
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
		await requirePermission('category:update');
		const contentType = req.headers.get('content-type') || '';
		let name = '';
		let active: any = true;
		let file: File | null = null;
		let removeImage = false;

		if (contentType.includes('multipart/form-data')) {
			const form = await req.formData();
			name = String(form.get('name') || '').trim();
			active = String(form.get('active') || 'true') === 'true';
			const f = form.get('image');
			if (f instanceof File && f.size > 0) file = f;
			removeImage = form.get('removeImage') === 'true';
		} else {
			const body = await req.json();
			name = (body.name||'').trim();
			active = body.active ?? true;
			removeImage = body.removeImage === true;
		}
		if (!name) return err(400,'NAME_REQUIRED','Name required');
		const slug = slugify(name);

		const existing = await prisma.category.findUnique({ where: { id: params.id }, select: { imageUrl: true } });
		if (!existing) return err(404,'NOT_FOUND');
		let finalImage = existing.imageUrl || FALLBACK_IMAGE;
		let oldImageToDelete: string | null = null;

		if (file) {
			try {
				const saved = await saveUploadedFile(file,'media/categories', slug);
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
		} else if (removeImage) {
			if (existing.imageUrl && existing.imageUrl !== FALLBACK_IMAGE) oldImageToDelete = existing.imageUrl;
			finalImage = FALLBACK_IMAGE;
		}

		const category = await prisma.category.update({ where: { id: params.id }, data: { name, slug, active, imageUrl: finalImage } });
		logAudit('category.update','Category', category.id, { name });
		if (oldImageToDelete) deleteIfLocal(oldImageToDelete); // fire & forget
		return NextResponse.json(category);
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'DUPLICATE','Ya existe una categoría con ese nombre.');
		return serverErrorResponse('admin.categories.PUT', e, 'Error al actualizar la categoría.');
	}
}

export async function DELETE(_: Request, { params }: Params) {
	try {
		await requirePermission('category:delete');
		const existing = await prisma.category.findUnique({ where: { id: params.id }, select: { imageUrl: true, name: true } });
		if (!existing) return err(404,'NOT_FOUND');
		// Regla de negocio: no se elimina una categoría que todavía tenga productos asociados.
		const [activeCount, totalCount] = await Promise.all([
			prisma.product.count({ where: { categoryId: params.id, active: true } }),
			prisma.product.count({ where: { categoryId: params.id } })
		]);
		if (activeCount > 0) {
			return err(409,'CATEGORY_HAS_ACTIVE_PRODUCTS',`No se puede eliminar "${existing.name}": tiene ${activeCount} producto${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'} asociado${activeCount === 1 ? '' : 's'}. Muévelos a otra categoría o desactívalos primero.`);
		}
		if (totalCount > 0) {
			return err(409,'CATEGORY_HAS_PRODUCTS',`No se puede eliminar "${existing.name}": aún tiene ${totalCount} producto${totalCount === 1 ? '' : 's'} inactivo${totalCount === 1 ? '' : 's'}. Reasígnalos a otra categoría primero.`);
		}
		await prisma.category.delete({ where: { id: params.id } });
		logAudit('category.delete','Category', params.id);
		if (existing.imageUrl && existing.imageUrl !== FALLBACK_IMAGE) deleteIfLocal(existing.imageUrl);
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return serverErrorResponse('admin.categories.DELETE', e, 'Error al eliminar la categoría.');
	}
}
