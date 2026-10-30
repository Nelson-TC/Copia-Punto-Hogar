import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { requirePermission } from '../../../../src/lib/permissions';
import { FALLBACK_IMAGE, saveUploadedFile, slugify } from '../../../../src/lib/uploads';
import { logAudit } from '../../../../src/lib/audit';
import { isUniqueViolation, serverErrorResponse } from '../../../../src/lib/db-errors';

export const runtime = 'nodejs';

function err(status: number, code: string, message?: string) {
  return NextResponse.json({ error: message || code, code }, { status });
}

export async function GET(req: Request) {
	try {
		await requirePermission('category:read');
		const { searchParams } = new URL(req.url);
		const pageParam = searchParams.get('page');
		const perParam = searchParams.get('per');
		const q = (searchParams.get('q') || '').trim();
		const hasParams = Boolean(pageParam || perParam || q);
		const where: any = {};
		if (q) where.OR = [ { name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } } ];
		if (!hasParams) {
			const categories = await prisma.category.findMany({ where, orderBy: { createdAt: 'desc' } });
			return NextResponse.json(categories);
		}
		const page = Math.max(parseInt(pageParam || '1', 10) || 1, 1);
		const per = Math.min(Math.max(parseInt(perParam || '20', 10) || 20, 1), 100);
		const [total, items] = await Promise.all([
			prisma.category.count({ where }),
			prisma.category.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*per, take: per })
		]);
		return NextResponse.json({ items, page, per, total, totalPages: Math.max(1, Math.ceil(total / per)) });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return err(500,'SERVER_ERROR','Error fetching categories');
	}
}

export async function POST(req: Request) {
	try {
		await requirePermission('category:create');
		const contentType = req.headers.get('content-type') || '';
		let name = '';
		let active: any = true;
		let file: File | null = null;
		let imageUrl: string | null = null;

		if (contentType.includes('multipart/form-data')) {
			const form = await req.formData();
			name = String(form.get('name') || '').trim();
			active = String(form.get('active') || 'true') === 'true';
			const f = form.get('image');
			if (f instanceof File && f.size > 0) file = f;
		} else {
				const body = await req.json();
				name = (body.name||'').trim();
				active = body.active ?? true;
				// allow explicit slug on JSON create
				if (body.slug && typeof body.slug === 'string') {
					// only used to override default slugify(name)
				}
			}
		if (!name) return err(400,'NAME_REQUIRED','Name required');
	const slug = slugify(name);

		if (file) {
			try {
				const saved = await saveUploadedFile(file,'media/categories', slug);
				imageUrl = saved.relativePath;
			} catch (uploadErr: any) {
				if (uploadErr instanceof Error) {
					if (uploadErr.message === 'FILE_TOO_LARGE') return err(400,'FILE_TOO_LARGE');
					if (uploadErr.message === 'INVALID_MIME') return err(400,'INVALID_MIME');
					if (uploadErr.message === 'INVALID_EXT') return err(400,'INVALID_EXT');
				}
				return err(500,'UPLOAD_FAILED');
			}
		} else {
			imageUrl = FALLBACK_IMAGE;
		}

		const category = await prisma.category.create({ data: { name, slug, active, imageUrl } });
		logAudit('category.create','Category', category.id, { name });
		return NextResponse.json(category, { status: 201 });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'DUPLICATE','Ya existe una categoría con ese nombre.');
		return serverErrorResponse('admin.categories.POST', e, 'Error al crear la categoría.');
	}
}
