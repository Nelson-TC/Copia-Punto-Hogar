"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

// Acciones del encabezado del panel: volver a la tienda y cerrar sesión.
export default function AdminHeaderActions() {
  const router = useRouter();
  const { session, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {session?.email && <span className="hidden text-neutral-500 sm:inline">{session.email}</span>}
      <Link href="/" className="px-3 py-1.5 font-medium border rounded-md border-nav/20 text-nav hover:bg-nav hover:text-white transition">Ver tienda</Link>
      <button type="button" onClick={onLogout} className="px-3 py-1.5 font-medium rounded-md bg-carrot text-nav hover:bg-carrot-dark hover:text-white transition">Cerrar sesión</button>
    </div>
  );
}
