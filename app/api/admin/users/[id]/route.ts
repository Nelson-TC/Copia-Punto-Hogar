import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/lib/prisma';
import { requirePermission, invalidatePermissions, getUserPermissions } from '../../../../../src/lib/permissions';
import { logAudit } from '../../../../../src/lib/audit';
import { getSession } from '../../../../../src/lib/auth';
import { isForeignKeyViolation, isUniqueViolation, serverErrorResponse } from '../../../../../src/lib/db-errors';
import { MIN_PASSWORD_LENGTH, assertCanChangeAdminRole, resolveRoleIds, validateEmail } from '../../../../../src/lib/user-admin';
import bcrypt from 'bcryptjs';

interface Params { params: { id: string } }

function err(status: number, code: string, message?: string) { return NextResponse.json({ error: message || code, code }, { status }); }

export async function GET(_: Request, { params }: Params) {
	try {
		await requirePermission('user:read');
		const user = await prisma.user.findUnique({ where: { id: params.id } });
		if (!user) return err(404,'NOT_FOUND','Usuario no encontrado.');
		const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
		return NextResponse.json({ id: user.id, email: user.email, name: user.name, roles: roles.map(r=> r.role.name), createdAt: user.createdAt });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		return serverErrorResponse('admin.users.id.GET', e);
	}
}

export async function PUT(req: Request, { params }: Params) {
	try {
		await requirePermission('user:update');
		const body = await req.json().catch(() => null);
		const email = typeof body?.email === 'string' && body.email.trim() ? String(body.email).trim().toLowerCase() : undefined;
		const name = body?.name !== undefined ? (body.name ? String(body.name).trim() : null) : undefined;
		const roleIds = await resolveRoleIds(body);
		const password: string | undefined = typeof body?.password === 'string' && body.password ? body.password : undefined;

		if (email !== undefined && !validateEmail(email)) return err(400,'INVALID_EMAIL','El formato del correo no es válido.');
		if (password && password.length < MIN_PASSWORD_LENGTH) return err(400,'INVALID_PASSWORD',`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);

		const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
		if (!existing) return err(404,'NOT_FOUND','Usuario no encontrado.');

		if (roleIds) {
			const current = await prisma.userRole.findMany({ where: { userId: params.id }, select: { roleId: true } });
			// Solo un Administrador puede otorgar o retirar el rol "admin" (control de acceso por rol).
			await assertCanChangeAdminRole(roleIds, current.map(c => c.roleId));
			// Y nadie puede quitarse a sí mismo el acceso de administrador (evita dejar el sistema sin admins).
			const session = await getSession();
			if (session?.sub === params.id) {
				const adminRole = await prisma.roleEntity.findUnique({ where: { name: 'admin' }, select: { id: true } });
				if (adminRole && current.some(c => c.roleId === adminRole.id) && !roleIds.includes(adminRole.id)) {
					return err(409,'SELF_DEMOTE','No puedes quitarte a ti mismo el rol de Administrador.');
				}
			}
		}

		const data: any = {};
		if (email !== undefined) data.email = email;
		if (name !== undefined) data.name = name;
		if (password) data.passwordHash = await bcrypt.hash(password, 10);

		const user = await prisma.$transaction(async (tx) => {
			const updated = await tx.user.update({ where: { id: params.id }, data });
			if (roleIds) {
				await tx.userRole.deleteMany({ where: { userId: updated.id } });
				if (roleIds.length) await tx.userRole.createMany({ data: roleIds.map(roleId => ({ userId: updated.id, roleId })) });
			}
			return updated;
		});
		invalidatePermissions(user.id);
		logAudit('user.update','User', user.id, { email, name, roleIds: roleIds ?? 'KEEP' });
		const assigned = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
		return NextResponse.json({ id: user.id, email: user.email, name: user.name, roles: assigned.map(a=> a.role.name), createdAt: user.createdAt });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isUniqueViolation(e)) return err(409,'USER_EXISTS','Ya existe un usuario con ese correo.');
		return serverErrorResponse('admin.users.id.PUT', e, 'Error al actualizar el usuario.');
	}
}

export async function DELETE(_: Request, { params }: Params) {
	try {
		await requirePermission('user:delete');
		const session = await getSession();
		if (session?.sub === params.id) return err(409,'SELF_DELETE','No puedes eliminar tu propia cuenta.');
		const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, userRoles: { select: { role: { select: { name: true } } } } } });
		if (!target) return err(404,'NOT_FOUND','Usuario no encontrado.');
		// Eliminar a un Administrador también está reservado a otro Administrador.
		if (target.userRoles.some(r => r.role.name === 'admin')) {
			const perms = session ? await getUserPermissions(session.sub) : new Set<string>();
			if (!perms.has('admin:access')) return err(403,'FORBIDDEN');
		}
		// Los clientes con pedidos conservan su historial de compras: no se eliminan.
		const orderCount = await prisma.order.count({ where: { userId: params.id } });
		if (orderCount > 0) return err(409,'USER_HAS_RECORDS',`Este usuario tiene ${orderCount} pedido${orderCount === 1 ? '' : 's'} registrado${orderCount === 1 ? '' : 's'} y no puede eliminarse.`);
		await prisma.user.delete({ where: { id: params.id } });
		invalidatePermissions(params.id);
		logAudit('user.delete','User', params.id);
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		if (e instanceof Error) {
			if (e.message === 'UNAUTHENTICATED') return err(401,'UNAUTHENTICATED');
			if (e.message === 'FORBIDDEN') return err(403,'FORBIDDEN');
		}
		if (isForeignKeyViolation(e)) return err(409,'USER_HAS_RECORDS','Este usuario tiene pedidos o productos asociados y no puede eliminarse.');
		return serverErrorResponse('admin.users.id.DELETE', e, 'Error al eliminar el usuario.');
	}
}
