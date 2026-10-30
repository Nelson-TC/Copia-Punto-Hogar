import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/lib/prisma';
import { verifyPassword, createSessionCookie } from '../../../../src/lib/auth';
import { serverErrorResponse } from '../../../../src/lib/db-errors';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      return NextResponse.json({ error: 'Ingresa tu correo y tu contraseña.', code: 'VALIDATION' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    // Mismo mensaje si el correo no existe o la contraseña es incorrecta: no se revela cuál dato falló.
    if (!user) return NextResponse.json({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    await createSessionCookie({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorResponse('auth.login', e, 'No se pudo iniciar sesión. Intenta más tarde.');
  }
}
