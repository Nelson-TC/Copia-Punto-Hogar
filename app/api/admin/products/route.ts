import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { requirePermission } from '../../../../src/lib/permissions';
import { FALLBACK_IMAGE, saveUploadedFile, slugify } from '../../../../src/lib/uploads';
import { logAudit } from '../../../../src/lib/audit';
import { validateProductInput } from '../../../../src/lib/product-validation';
import { isUniqueViolation, serverErrorResponse } from '../../../../src/lib/db-errors';

export const runtime = 'nodejs';

function err(status: number, code: string, message?: string) { return NextResponse.json({ error: message || code, code }, { status }); }

export async function GET(req: Request) {
	try {
		await requirePermission('product:read');
		const { searchParams } = new URL(req.url);
		const pageParam = searchParams.get('page');
		const perParam = searchParams.get('per');
		const sortParam = (searchParams.get('sort') || 'new').trim();
		const q = (searchParams.get('q') || '').trim();
		const cat = (searchParams.get('cat') || '').trim(); // category id or slug
		const activeParam = searchParams.get('active'); // 'true' | 'false' | 'all'

		const hasParams = Boolean(pageParam || perParam || sortParam || q || cat || activeParam);

		const where: any = {};
		if (activeParam && activeParam !== 'all') where.active = activeParam === 'true';
		if (q) {
			where.AND = (where.AND || []).concat([
				{ OR: [
					{ name: { contains: q, mode: 'insensitive' } },
					{ description: { contains: q, mode: 'insensitive' } }
				]}
			]);
		}
		if (cat) {
			where.AND = (where.AND || []).concat([
				{ OR: [ { categoryId: cat }, { category: { slug: cat } } ] }
			]);
		}

		let orderBy: any = { createdAt: 'desc' };
		switch (sortParam) {
			case 'price_asc': orderBy = { price: 'asc' }; break;
			case 'price_desc': orderBy = { price: 'desc' }; break;
			case 'name': orderBy = { name: 'asc' }; break;
			case 'new': default: orderBy = { createdAt: 'desc' };
		}

		if (!hasParams) {
			const products = await prisma.product.findMany({ include: { category: true }, orderBy });
			return NextResponse.json(products);
		}

		const page = Math.max(parseInt(pageParam || '1', 10) || 1, 1);
		const perRaw = Math.max(parseInt(perParam || '20', 10) || 20, 1);
		const per = Math.min(perRaw, 100);
		const skip = (page - 1) * per;

		const [total, items] = await Promise.all([
			prisma.product.count({ where }),
			prisma.product.findMany({ where, skip, take: per, orderBy, include: { category: true } })
		]);
		const totalPages = Math.max(Math.ceil(total / per), 1);
		return NextResponse.json({ items, page, per, total, totalPages });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return err(500,'SERVER_ERROR','Error fetching products');
	}
}

export async function POST(req: Request) {
	try {
		await requirePermission('product:create');
		const contentType = req.headers.get('content-type') || '';
		let raw: { name?: unknown; price?: unknown; costPrice?: unknown; stock?: unknown; categoryId?: unknown; description?: unknown } = {};
		let active: any = true;
		let imageUrl: string | null = null;
		let file: File | null = null;

		if (contentType.includes('multipart/form-data')) {
			const form = await req.formData();
			raw = { name: form.get('name'), price: form.get('price'), costPrice: form.get('costPrice'), stock: form.get('stock'), categoryId: form.get('categoryId'), description: form.get('description') };
			active = String(form.get('active') || 'true') === 'true';
			const f = form.get('image');
			if (f instanceof File && f.size > 0) file = f;
		} else {
			const body = await req.json().catch(() => null);
			if (!body || typeof body !== 'object') return err(400,'MISSING_FIELDS','Faltan campos obligatorios.');
			raw = body;
			active = body.active ?? true;
		}

		// Validación en el servidor (precio > 0, stock entero >= 0, nombre y categoría obligatorios).
		const parsed = validateProductInput(raw);
		if (!parsed.ok) return err(400, parsed.code, parsed.message);
		const { name, price: numericPrice, costPrice, stock, categoryId, description } = parsed.value;
		const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
		if (!category) return err(400,'CATEGORY_REQUIRED','La categoría seleccionada no existe.');
		const slug = slugify(name);

		if (file) {
			try {
				const saved = await saveUploadedFile(file,'items', slug);
				imageUrl = saved.relativePath;
			} catch (uploadErr: any) {
				if (uploadErr instanceof Error) {
					if (uploadErr.message === 'FILE_TOO_LARGE') return err(400,'FILE_TOO_LARGE');
					if (uploadErr.message === 'INVALID_MIME') return err(400,'INVALID_MIME');
					if (uploadErr.message === 'INVALID_EXT') return err(400,'INVALID_EXT');
				}
				return err(500,'UPLOAD_FAILED');
			}
		}
		if (!imageUrl) imageUrl = FALLBACK_IMAGE;

		const product = await prisma.product.create({ data: { name, slug, price: numericPrice, costPrice, stock, description, categoryId, imageUrl, active } });
		logAudit('product.create','Product', product.id, { name, stock, costPrice });
		return NextResponse.json(product, { status: 201 });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'DUPLICATE','Ya existe un producto con ese nombre. Usa un nombre distinto.');
		return serverErrorResponse('admin.products.POST', e, 'Error al crear el producto.');
	}
}
