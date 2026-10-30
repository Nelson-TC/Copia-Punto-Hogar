"use client";
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { fetchWithTimeout } from '../../src/lib/http';

function LoginInner() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const sp = useSearchParams();
	const { refresh } = useAuth();

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			const res = await fetchWithTimeout('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar sesión');
			await refresh();
			// Solo rutas internas (evita redirecciones abiertas): /algo pero nunca //host
			const requested = sp?.get('next') || sp?.get('from') || '';
			const safeNext = requested.startsWith('/') && !requested.startsWith('//') ? requested : '';
			if (safeNext) { router.replace(safeNext); return; }
			// Sin destino explícito se redirige según el rol: administradores al panel, clientes a su cuenta.
			const me = await fetchWithTimeout('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
			const perms: string[] = Array.isArray(me?.permissions) ? me.permissions : [];
			router.replace(perms.includes('admin:access') || perms.includes('dashboard:access') ? '/admin' : '/account');
		} catch (err: any) {
			setError(err.message || 'No se pudo iniciar sesión');
		} finally { setLoading(false); }
	}

	return (
		<div className="flex flex-1 w-full">
			{/* Form card */}
			<div className="flex items-center justify-center w-full px-5 bg-neutral-50">
				<div className="w-full max-w-sm">
					<div className="mb-8 space-y-2 text-center">
						<h1 className="text-4xl font-extrabold">Iniciar sesión</h1>
						<p className="text-sm text-neutral-600">Accede a tu cuenta para continuar.</p>
					</div>
					<form onSubmit={onSubmit} aria-describedby={error ? 'form-error' : undefined} className="relative p-6 space-y-6 border shadow-sm bg-white/90 border-neutral-200 rounded-2xl backdrop-blur">
						<div className="space-y-2">
							<label htmlFor="email" className="text-xs font-medium tracking-wide text-neutral-700">Email</label>
							<input id="email" autoComplete="email" className="w-full px-3 py-2 text-sm border rounded-md shadow-sm border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60" placeholder="tu@correo.com" type="email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true" />
						</div>
						<div className="space-y-2">
							<label htmlFor="password" className="flex items-center justify-between text-xs font-medium tracking-wide text-neutral-700">
								<span>Contraseña</span>
								{/* Future link for password recovery */}
								<span className="text-[11px] text-carrot hover:text-carrot-dark cursor-pointer select-none" aria-hidden="true">Olvidé la contraseña</span>
							</label>
							<div className="relative">
								<input id="password" autoComplete="current-password" className="w-full px-3 py-2 pr-10 text-sm border rounded-md shadow-sm border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60" placeholder="••••••••" type={showPassword ? 'text':'password'} value={password} onChange={e => setPassword(e.target.value)} required aria-required="true" aria-invalid={!!error || undefined} />
								<button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded-r-md" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
									<i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-lg`} />
								</button>
							</div>
						</div>
						{error && <p id="form-error" role="alert" className="text-sm text-red-600">{error}</p>}
						<button type="submit" disabled={loading} aria-busy={loading} className="w-full px-5 py-2.5 text-sm font-semibold rounded-full bg-carrot text-nav hover:bg-carrot-dark disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/70 transition flex items-center justify-center gap-2">
							{loading && <i className='text-base bx bx-loader-alt animate-spin' />}
							{loading ? 'Ingresando…' : 'Ingresar'}
						</button>
						<p className="pt-1 text-xs text-center text-neutral-500">¿No tienes cuenta? <a href="/register" className="font-medium text-carrot hover:text-carrot-dark underline-offset-4 hover:underline">Crear una</a></p>
					</form>
					<p className="mt-6 text-[11px] text-neutral-500 text-center">Protegemos tus credenciales con cifrado. Nunca compartas tu contraseña.</p>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="py-10 text-center">Cargando…</div>}>
			<LoginInner />
		</Suspense>
	);
}
