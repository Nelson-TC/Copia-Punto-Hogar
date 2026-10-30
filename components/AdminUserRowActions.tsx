"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mapApiError } from '../src/lib/client-errors';
import { fetchWithTimeout } from '../src/lib/http';

interface Props {
	id: string;
	email: string;
	isSelf: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

export default function AdminUserRowActions({ id, email, isSelf, canUpdate, canDelete }: Props) {
	const router = useRouter();
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function remove() {
		if (!window.confirm(`¿Eliminar al usuario ${email}?`)) return;
		setError(null);
		setDeleting(true);
		try {
			const res = await fetchWithTimeout(`/api/admin/users/${id}`, { method: 'DELETE' });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(mapApiError(data, 'No se pudo eliminar el usuario'));
			router.refresh();
		} catch (e: any) {
			setError(e.message || 'Error');
		} finally { setDeleting(false); }
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex items-center gap-3">
				{canUpdate && <Link href={`/admin/users/${id}`} className="text-xs font-medium text-carrot hover:underline">Editar</Link>}
				{canDelete && !isSelf && <button type="button" onClick={remove} disabled={deleting} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40">{deleting ? 'Eliminando…' : 'Eliminar'}</button>}
			</div>
			{error && <p role="alert" className="max-w-[320px] text-[11px] text-right text-red-600">{error}</p>}
		</div>
	);
}
