"use client";
import { useEffect } from 'react';

// Límite de error de la aplicación: si una página falla (por ejemplo, PostgreSQL deja de responder)
// el usuario ve un mensaje claro y puede reintentar, en lugar de una pantalla en blanco o técnica.
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		// El detalle técnico queda solo en la consola del servidor/navegador; no se muestra al usuario.
		console.error('[app-error]', error?.digest || '', error?.message);
	}, [error]);

	return (
		<div role="alert" className="max-w-xl px-4 py-20 mx-auto space-y-6 text-center">
			<div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-600">
				<i className="text-3xl bx bx-error" />
			</div>
			<h1 className="text-2xl font-bold tracking-tight">No fue posible conectar con el servidor</h1>
			<p className="text-sm text-neutral-600">
				Estamos teniendo problemas para cargar esta página. Tus datos están a salvo.
				Intenta nuevamente en unos momentos; si el problema continúa, vuelve más tarde.
			</p>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<button onClick={() => reset()} className="px-5 py-2.5 text-sm font-semibold rounded-full bg-carrot text-nav hover:bg-carrot-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60">Reintentar</button>
				<a href="/" className="px-5 py-2.5 text-sm font-medium border rounded-full border-neutral-300 hover:bg-neutral-100">Ir al inicio</a>
			</div>
		</div>
	);
}
