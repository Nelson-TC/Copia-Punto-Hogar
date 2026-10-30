"use client";
import { useState, useTransition } from 'react';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';
import { mapApiError } from '../src/lib/client-errors';
import { usePermissions } from '../src/lib/use-permissions';

interface UserFormValues {
  id?: string;
  email: string;
  name: string;
  password?: string;
  roleIds: string[]; // multi-role assignment
}

interface RoleOption { id: string; name: string; label: string }

interface AdminUserFormProps {
	initial?: any | null;
	mode?: 'create' | 'edit';
	roles?: RoleOption[]; // available roles from server
	initialRoleIds?: string[]; // pre-assigned role ids
}

export default function AdminUserForm({ initial, mode='create', roles = [], initialRoleIds = [] }: AdminUserFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const { session, refresh } = useAuth();
	const [values, setValues] = useState<UserFormValues>({
    id: initial?.id,
    email: initial?.email || '',
    name: initial?.name || '',
    password: '',
    roleIds: initialRoleIds || []
  });
	const [errors, setErrors] = useState<Record<string,string>>({});
	const [serverError, setServerError] = useState<string|null>(null);
	const [serverSuccess, setServerSuccess] = useState<string|null>(null);
	const { can } = usePermissions();
	const cannotEdit = values.id ? !can('user:update') : !can('user:create');

	function validate(v: UserFormValues) {
		const e: Record<string,string> = {};
		if (!v.email.trim()) e.email = 'Email requerido';
		if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = 'Formato inválido';
		if (mode==='create' && !v.password?.trim()) e.password = 'Contraseña requerida';
		if (v.password && v.password.length < 8) e.password = 'Mínimo 8 caracteres';
		return e;
	}

	function update<K extends keyof UserFormValues>(key: K, val: UserFormValues[K]) {
		setValues(s => ({ ...s, [key]: val }));
		if (errors[key as string]) setErrors(e => { const c = { ...e }; delete c[key as string]; return c; });
	}

	function toggleRole(id: string) {
		setValues(s => ({ ...s, roleIds: s.roleIds.includes(id) ? s.roleIds.filter(r => r !== id) : [...s.roleIds, id] }));
	}

	async function onSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		setServerError(null); setServerSuccess(null);
		const e = validate(values); setErrors(e); if (Object.keys(e).length) return;
		const payload: any = { email: values.email.trim(), name: values.name.trim() || null, roleIds: values.roleIds };
		if (values.password) payload.password = values.password;
		startTransition(async ()=>{
			try {
				const res = await fetch(values.id? `/api/admin/users/${values.id}`:'/api/admin/users', {
					method: values.id? 'PUT':'POST',
					headers: { 'Content-Type':'application/json' },
					body: JSON.stringify(payload)
				});
				if (!res.ok) {
					const data = await res.json().catch(()=>null);
					throw new Error(mapApiError(data));
				}
				setServerSuccess(values.id? 'Usuario actualizado':'Usuario creado');
				// Si el usuario editado es el mismo que la sesión, forzar refresco de permisos para reflejar roles nuevos
				if (values.id && session?.sub === values.id) {
					if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('auth:changed'));
					await refresh();
				}
				setTimeout(()=>{ router.push('/admin/users'); router.refresh(); }, 700);
			} catch(err:any) { setServerError(err.message || 'Error'); }
		});
	}

	return (
		<form onSubmit={onSubmit} className="space-y-7" noValidate>
			<div className="space-y-1">
				<h1 className="text-xl font-semibold tracking-tight">{mode==='edit'? 'Editar usuario':'Nuevo usuario'}</h1>
				<p className="text-sm text-neutral-500">Gestiona acceso y rol dentro del panel.</p>
			</div>
			{serverError && <div className="px-3 py-2 text-sm rounded-md bg-red-100 text-red-700">{serverError}</div>}
			{serverSuccess && <div className="px-3 py-2 text-sm rounded-md bg-green-100 text-green-700">{serverSuccess}</div>}
			<div className="grid gap-6 md:grid-cols-2">
				<div className="space-y-2">
					<label htmlFor="email" className="text-sm font-medium text-neutral-700">Email <span className="text-red-500">*</span></label>
					<input id="email" value={values.email} onChange={e=>update('email', e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.email? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="usuario@correo.com" />
					{errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
				</div>
				<div className="space-y-2">
					<label htmlFor="name" className="text-sm font-medium text-neutral-700">Nombre</label>
					<input id="name" value={values.name} onChange={e=>update('name', e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border bg-white border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50" placeholder="Nombre opcional" />
				</div>
				<div className="space-y-2">
						<span className="text-sm font-medium text-neutral-700">Roles</span>
						{roles.length === 0 && <p className="text-xs text-neutral-500">No hay roles disponibles.</p>}
						<ul className="space-y-1 max-h-44 overflow-auto pr-1 border rounded-md p-2 bg-white border-neutral-200">
							{roles.map(r => {
								const active = values.roleIds.includes(r.id);
								return (
									<li key={r.id} className="flex items-center gap-2 text-sm">
										<label className="inline-flex items-center gap-2 cursor-pointer select-none">
											<input
												type="checkbox"
												className="w-4 h-4 rounded border-neutral-300 text-carrot focus:ring-carrot/50 focus:outline-none"
												checked={active}
												onChange={()=>toggleRole(r.id)}
												disabled={cannotEdit}
											/>
											<span className="font-medium text-neutral-700">{r.label || r.name}</span>
										</label>
									</li>
								);
							})}
						</ul>
						<p className="text-[11px] text-neutral-500">Selecciona uno o más roles para este usuario.</p>
					</div>
				<div className="space-y-2">
					<label htmlFor="password" className="text-sm font-medium text-neutral-700">Contraseña {mode==='create' && <span className="text-red-500">*</span>}</label>
					<input id="password" type="password" value={values.password} onChange={e=>update('password', e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.password? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder={mode==='edit'? '(Dejar vacío para no cambiar)':'••••••'} />
					{errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
				</div>
			</div>
			<div className="flex flex-wrap gap-3 pt-2">
				<button disabled={isPending || cannotEdit} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md bg-carrot text-nav hover:bg-carrot-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 disabled:opacity-60 disabled:cursor-not-allowed">
					{isPending && <i className='bx bx-loader-alt animate-spin text-base'/>}
					{values.id? 'Guardar cambios':'Crear usuario'}
				</button>
				<button type="button" disabled={isPending} onClick={()=>router.push('/admin/users')} className="px-5 py-2.5 text-sm font-medium transition rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 disabled:opacity-50">Cancelar</button>
				{cannotEdit && <p className="w-full text-xs text-red-500">No tienes permiso para {values.id? 'actualizar':'crear'} usuarios.</p>}
			</div>
		</form>
	);
}
