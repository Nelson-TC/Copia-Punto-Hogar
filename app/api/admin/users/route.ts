import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { requirePermission, invalidatePermissions } from '../../../../src/lib/permissions';
import { logAudit } from '../../../../src/lib/audit';
import { isUniqueViolation, serverErrorResponse } from '../../../../src/lib/db-errors';
import { MIN_PASSWORD_LENGTH, assertCanChangeAdminRole, resolveRoleIds, validateEmail } from '../../../../src/lib/user-admin';
import bcrypt from 'bcryptjs';

function err(status: number, code: string, message?: string) { return NextResponse.json({ error: message || code, code }, { status }); }

export async function GET(req: Request) {
	try {
		await requirePermission('user:read');
		const { searchParams } = new URL(req.url);
		const q = (searchParams.get('q') || '').trim();
		const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
		const per = Math.min(Math.max(parseInt(searchParams.get('per') || '20', 10) || 20, 1), 100);
		const where: any = {};
		if (q) where.OR = [ { email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } } ];
		const [total, rows] = await Promise.all([
			prisma.user.count({ where }),
			prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*per, take: per })
		]);
		const ids = rows.map(u=> u.id);
		const userRoles = ids.length ? await prisma.userRole.findMany({ where: { userId: { in: ids } }, include: { role: true } }) : [];
		const rolesByUser = new Map<string,string[]>();
		for (const ur of userRoles) {
			const list = rolesByUser.get(ur.userId) || [];
			list.push(ur.role.name);
			rolesByUser.set(ur.userId, list);
		}
		const items = rows.map(u => ({ id: u.id, email: u.email, name: u.name, roles: rolesByUser.get(u.id) || [], createdAt: u.createdAt }));
		return NextResponse.json({ items, page, per, total, totalPages: Math.max(1, Math.ceil(total / per)) });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return serverErrorResponse('admin.users.GET', e, 'Error al consultar usuarios.');
	}
}

export async function POST(req: Request) {
	try {
		await requirePermission('user:create');
		const body = await req.json().catch(() => null);
		const email = String(body?.email||'').trim().toLowerCase();
		const name = body?.name? String(body.name).trim(): null;
		const roleIds = (await resolveRoleIds(body)) ?? [];
		const password: string | undefined = typeof body?.password === 'string' && body.password ? body.password : undefined;
		if (!email) return err(400,'EMAIL_REQUIRED','El email es obligatorio.');
		if (!validateEmail(email)) return err(400,'INVALID_EMAIL','El formato del correo no es válido.');
		if (!password || password.length < MIN_PASSWORD_LENGTH) return err(400,'INVALID_PASSWORD',`La contraseña es obligatoria y debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
		await assertCanChangeAdminRole(roleIds);
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) return err(409,'USER_EXISTS','Ya existe un usuario con ese correo.');
		const passwordHash = await bcrypt.hash(password, 10);
		const created = await prisma.user.create({ data: { email, name, passwordHash } });
		if (roleIds.length) {
			await prisma.userRole.createMany({ data: roleIds.map(roleId => ({ userId: created.id, roleId })) });
		}
		invalidatePermissions(created.id);
		logAudit('user.create','User', created.id, { email, roleIds });
		const assigned = await prisma.userRole.findMany({ where: { userId: created.id }, include: { role: true } });
		return NextResponse.json({ id: created.id, email: created.email, name: created.name, roles: assigned.map(a=> a.role.name), createdAt: created.createdAt }, { status: 201 });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'USER_EXISTS','Ya existe un usuario con ese correo.');
		return serverErrorResponse('admin.users.POST', e, 'Error al crear el usuario.');
	}
}
