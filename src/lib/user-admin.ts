import { prisma } from './prisma';
import { getSession } from './auth';
import { getUserPermissions } from './permissions';

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Convierte el cuerpo de la petición en una lista de ids de rol.
 * Acepta `roleIds` (lo que envía el formulario del panel) o `roles` (nombres, usado por clientes de la API).
 * Devuelve undefined cuando la petición no menciona roles (no se tocan los existentes).
 */
export async function resolveRoleIds(body: any): Promise<string[] | undefined> {
  if (Array.isArray(body?.roleIds)) {
    const ids = body.roleIds.map((r: any) => String(r));
    if (!ids.length) return [];
    const rows = await prisma.roleEntity.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return rows.map(r => r.id);
  }
  if (Array.isArray(body?.roles)) {
    const names = body.roles.map((r: any) => String(r));
    if (!names.length) return [];
    const rows = await prisma.roleEntity.findMany({ where: { name: { in: names } }, select: { id: true } });
    return rows.map(r => r.id);
  }
  return undefined;
}

/**
 * Solo quien tiene acceso total (rol Administrador) puede otorgar o retirar el rol "admin".
 * Evita que alguien con permiso `user:update` se asigne a sí mismo privilegios de administrador.
 * Lanza FORBIDDEN si no corresponde.
 */
export async function assertCanChangeAdminRole(touchedRoleIds: string[], currentRoleIds: string[] = []) {
  const adminRole = await prisma.roleEntity.findUnique({ where: { name: 'admin' }, select: { id: true } });
  if (!adminRole) return;
  const hadAdmin = currentRoleIds.includes(adminRole.id);
  const willHaveAdmin = touchedRoleIds.includes(adminRole.id);
  if (hadAdmin === willHaveAdmin) return;
  const session = await getSession();
  const perms = session ? await getUserPermissions(session.sub) : new Set<string>();
  if (!perms.has('admin:access')) throw new Error('FORBIDDEN');
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
