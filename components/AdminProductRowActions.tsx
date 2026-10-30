"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mapApiError } from '../src/lib/client-errors';
import { fetchWithTimeout } from '../src/lib/http';

interface Props {
	id: string;
	name: string;
	stock: number;
	canUpdate: boolean;
	canDelete: boolean;
}

// Acciones por fila: actualización rápida de existencias (RF10), edición y eliminación de productos.
export default function AdminProductRowActions({ id, name, stock, canUpdate, canDelete }: Props) {
	const router = useRouter();
	const [value, setValue] = useState(String(stock));
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
	const dirty = value !== String(stock);

	async function saveStock() {
		setMessage(null);
		if (!/^\d+$/.test(value.trim())) { setMessage({ type: 'error', text: 'El stock debe ser un entero mayor o igual a 0.' }); return; }
		setSaving(true);
		try {
			const res = await fetchWithTimeout(`/api/admin/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: Number(value) }) });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(mapApiError(data, 'No se pudo actualizar el stock'));
			setMessage({ type: 'ok', text: 'Stock actualizado' });
			router.refresh();
		} catch (e: any) {
			setMessage({ type: 'error', text: e.message || 'Error' });
		} finally { setSaving(false); }
	}

	async function remove() {
		if (!window.confirm(`¿Eliminar el producto "${name}"? Esta acción no se puede deshacer.`)) return;
		setMessage(null);
		setDeleting(true);
		try {
			const res = await fetchWithTimeout(`/api/admin/products/${id}`, { method: 'DELETE' });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(mapApiError(data, 'No se pudo eliminar el producto'));
			router.refresh();
		} catch (e: any) {
			setMessage({ type: 'error', text: e.message || 'Error' });
		} finally { setDeleting(false); }
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex flex-wrap items-center justify-end gap-2">
				{canUpdate && (
					<div className="flex items-center gap-1">
						<input
							aria-label={`Stock de ${name}`}
							inputMode="numeric"
							value={value}
							onChange={e => setValue(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter' && dirty) saveStock(); }}
							className="w-16 px-2 py-1 text-xs text-right border rounded border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50"
						/>
						<button type="button" onClick={saveStock} disabled={!dirty || saving} className="px-2 py-1 text-[11px] font-semibold rounded bg-carrot text-nav hover:bg-carrot-dark disabled:opacity-40 disabled:cursor-not-allowed">{saving ? '…' : 'Guardar'}</button>
					</div>
				)}
				{canUpdate && <Link href={`/admin/products/${id}`} className="text-xs font-medium text-carrot hover:underline">Editar</Link>}
				{canDelete && <button type="button" onClick={remove} disabled={deleting} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40">{deleting ? 'Eliminando…' : 'Eliminar'}</button>}
			</div>
			{message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`max-w-[320px] text-[11px] text-right ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p>}
		</div>
	);
}
