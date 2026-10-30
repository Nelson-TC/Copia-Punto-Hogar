import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { hashPassword, createSessionCookie } from '../../../../src/lib/auth';
import { isUniqueViolation, serverErrorResponse } from '../../../../src/lib/db-errors';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const name = String(body?.name || '').trim();

    // Mensajes específicos por campo (el frontend los muestra junto a cada input).
    const fields: Record<string, string> = {};
    if (name.length < 2) fields.name = 'Ingresa tu nombre (mínimo 2 caracteres).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Ingresa un correo electrónico válido.';
    if (password.length < MIN_PASSWORD_LENGTH) fields.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (Object.keys(fields).length) {
      return NextResponse.json({ error: Object.values(fields)[0], code: 'VALIDATION', fields }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Ese correo ya está registrado.', code: 'EMAIL_TAKEN', fields: { email: 'Ese correo ya está registrado.' } }, { status: 409 });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash, name, role: 'USER' } });
    await createSessionCookie({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: 'Ese correo ya está registrado.', code: 'EMAIL_TAKEN', fields: { email: 'Ese correo ya está registrado.' } }, { status: 409 });
    }
    return serverErrorResponse('auth.register', e, 'No se pudo crear la cuenta. Intenta más tarde.');
  }
}
