import { prisma } from './prisma';
import { getSession } from './auth';

/**
 * Registra una entrada de auditoría. Si no hay sesión se permite userId null.
 * action: string corta tipo "product.create" | "category.update" etc.
 * entity: nombre lógico de la entidad (Product, Category, User, Role, Permission, Order)
 * entityId: id afectado (si procede)
 * metadata: objeto adicional serializable (guardado como JSON)
 loll
 */
export async function logAudit(action: string, entity?: string, entityId?: string, metadata?: any) {
  try {
    const session = await getSession();
    await prisma.auditLog.create({
      data: {
        userId: session?.sub || null,
        action,
        entity: entity || null,
        entityId: entityId || null,
        metadata: metadata ? metadata : undefined
      }
    });
  } catch (e) {
    // Silencioso para no romper flujo principal
  }
}

// Helper específico para cambios de permisos/roles
export async function logRoleChange(kind: string, roleId: string, metadata?: any) {
  return logAudit(`role.${kind}`, 'Role', roleId, metadata);
}
