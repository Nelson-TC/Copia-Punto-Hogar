"use client";
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { ApiError, fetchWithTimeout } from '../../src/lib/http';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [name, setName] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const router = useRouter();
	const { refresh } = useAuth();

	// Misma validación que el servidor: se bloquea el envío con datos inválidos.
	function validate() {
		const e: Record<string, string> = {};
		if (name.trim().length < 2) e.name = 'Ingresa tu nombre (mínimo 2 caracteres).';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Ingresa un correo electrónico válido.';
		if (password.length < MIN_PASSWORD_LENGTH) e.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
		return e;
	}

	async function onSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		setError(null);
		const local = validate();
		setFieldErrors(local);
		if (Object.keys(local).length) return;
		setLoading(true);
		try {
			const res = await fetchWithTimeout('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				if (data?.fields) setFieldErrors(data.fields);
				throw new Error(data?.error || 'No se pudo registrar');
			}
			await refresh();
			router.replace('/account');
		} catch (err: any) {
			setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudo registrar');
		} finally { setLoading(false); }
	}

	const inputBase = 'w-full px-3 py-2 text-sm border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60';
	const cls = (field: string) => `${inputBase} ${fieldErrors[field] ? 'border-red-400' : 'border-neutral-300'}`;

	return (
		<div className="flex flex-1 w-full">
			<div className="flex items-center justify-center w-full px-5 bg-neutral-50">
				<div className="w-full max-w-sm">
					<div className="mb-8 space-y-2 text-center">
						<h1 className="text-4xl font-extrabold">Crear cuenta</h1>
						<p className="text-sm text-neutral-600">Regístrate para empezar a comprar en Punto Hogar.</p>
					</div>
					<form onSubmit={onSubmit} noValidate aria-describedby={error ? 'register-error' : undefined} className="relative p-6 space-y-6 border shadow-sm bg-white/90 border-neutral-200 rounded-2xl backdrop-blur">
						<div className="space-y-2">
							<label htmlFor="name" className="text-xs font-medium tracking-wide text-neutral-700">Nombre <span className="text-red-500">*</span></label>
							<input id="name" autoComplete="name" className={cls('name')} placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} aria-invalid={!!fieldErrors.name || undefined} />
							{fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
						</div>
						<div className="space-y-2">
							<label htmlFor="email" className="text-xs font-medium tracking-wide text-neutral-700">Correo electrónico <span className="text-red-500">*</span></label>
							<input id="email" autoComplete="email" className={cls('email')} placeholder="tu@correo.com" type="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email || undefined} />
							{fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
						</div>
						<div className="space-y-2">
							<label htmlFor="password" className="flex items-center justify-between text-xs font-medium tracking-wide text-neutral-700">
								<span>Contraseña <span className="text-red-500">*</span></span>
								<span className="text-[11px] text-neutral-500" aria-hidden="true">Mínimo {MIN_PASSWORD_LENGTH} caracteres</span>
							</label>
							<div className="relative">
								<input id="password" autoComplete="new-password" className={`${cls('password')} pr-10`} placeholder="••••••••" type={showPassword ? 'text':'password'} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!fieldErrors.password || undefined} />
								<button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 rounded-r-md" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
									<i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-lg`} />
								</button>
							</div>
							{fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
						</div>
						{error && !Object.keys(fieldErrors).length && <p id="register-error" role="alert" className="text-sm text-red-600">{error}</p>}
						<button type="submit" disabled={loading} aria-busy={loading} className="w-full px-5 py-2.5 text-sm font-semibold rounded-full bg-carrot text-nav hover:bg-carrot-dark disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/70 transition flex items-center justify-center gap-2">
							{loading && <i className='text-base bx bx-loader-alt animate-spin' />}
							{loading ? 'Creando…' : 'Crear cuenta'}
						</button>
						<p className="pt-1 text-xs text-center text-neutral-500">¿Ya tienes cuenta? <a href="/login" className="font-medium text-carrot hover:text-carrot-dark underline-offset-4 hover:underline">Iniciar sesión</a></p>
					</form>
					<p className="mt-6 text-[11px] text-neutral-500 text-center">Al crear la cuenta aceptas nuestras políticas. Protegemos tu privacidad.</p>
				</div>
			</div>
		</div>
	);
}
