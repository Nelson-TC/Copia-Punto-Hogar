import { NextResponse } from 'next/server';

export const DB_UNAVAILABLE_MESSAGE = 'No fue posible conectar con el servidor. Intenta nuevamente más tarde.';

// Códigos de Prisma que indican que la base de datos no responde (caída, red o tiempo agotado).
const DB_DOWN_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export function isDbUnavailable(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; code?: string; message?: string };
  if (err.name === 'PrismaClientInitializationError') return true;
  if (err.code && DB_DOWN_CODES.has(err.code)) return true;
  return typeof err.message === 'string' && /Can't reach database server|Connection terminated|ECONNREFUSED/i.test(err.message);
}

/** Código de violación de unicidad (correo, slug, etc.). */
export function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'P2002';
}

/** Violación de llave foránea (borrar algo que todavía está referenciado). */
export function isForeignKeyViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; message?: string };
  if (err.code === 'P2003') return true;
  // Con ON DELETE RESTRICT Prisma puede devolver un error sin código; se reconoce por el mensaje de PostgreSQL.
  return typeof err.message === 'string' && /violates (RESTRICT|foreign key)|foreign key constraint/i.test(err.message);
}

/** Registra el detalle técnico solo en el servidor; al cliente nunca se le expone. */
export function logServerError(scope: string, e: unknown) {
  const err = e as { message?: string; code?: string; stack?: string };
  console.error(`[${scope}]`, err?.code ? `(${err.code})` : '', err?.message || e);
}

/**
 * Respuesta JSON estándar para errores inesperados:
 * 503 si la base de datos no responde, 500 en cualquier otro caso. Sin datos sensibles.
 */
export function serverErrorResponse(scope: string, e: unknown, fallbackMessage = 'Error interno. Intenta más tarde.') {
  logServerError(scope, e);
  if (isDbUnavailable(e)) {
    return NextResponse.json({ error: DB_UNAVAILABLE_MESSAGE, code: 'DB_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ error: fallbackMessage, code: 'SERVER_ERROR' }, { status: 500 });
}
