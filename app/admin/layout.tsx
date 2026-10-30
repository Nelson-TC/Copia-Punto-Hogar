import '../../globals.css';
import { AdminSidebar } from '../../components/AdminSidebar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';
import { getUserPermissions } from '@/lib/permissions';
import AdminHeaderActions from '../../components/AdminHeaderActions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const user = await getCurrentUser();
	// Sin sesión: al inicio de sesión (el middleware ya cubre el caso normal; esto protege cualquier hueco).
	if (!user) redirect('/login?next=/admin');
	const perms = await getUserPermissions(user.id);
	// Cliente sin permisos de administración: se le deniega el acceso y se le devuelve al catálogo,
	// sin mostrar nada del panel.
	if (!(perms.has('admin:access') || perms.has('dashboard:access'))) redirect('/products');
	return (
		<div className="flex min-h-screen bg-surface-alt">
			<div className="flex flex-col flex-1 min-w-0 md:pl-64">
				<header className="sticky top-0 z-30 flex items-center px-6 border-b h-14 bg-white/80 backdrop-blur">
					<div className="flex items-center justify-between w-full">
						<div className="flex items-center gap-3 text-sm">
							<Link href="/" className="font-semibold text-nav">Punto Hogar</Link>
							<span className="hidden text-[11px] px-2 py-0.5 rounded-full bg-carrot/50 text-black font-semibold md:inline-block">Admin</span>
						</div>
						<AdminHeaderActions />
					</div>
				</header>
				<main id="main-content" tabIndex={-1} className="w-full p-6 mx-auto space-y-10 outline-none max-w-7xl">{children}</main>
			</div>
			<AdminSidebar />
		</div>
	);
}
