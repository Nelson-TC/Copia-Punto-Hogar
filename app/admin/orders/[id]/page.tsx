import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { getUserPermissions } from '@/lib/permissions';
import { AdminOrderStatusControls } from '../../../../components/AdminOrderStatusControls';

interface Props { params: { id: string }; }

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: Props) {
	const current = await getCurrentUser();
	if (!current) return <p className="text-sm text-red-600">No autenticado.</p>;
	const perms = await getUserPermissions(current.id);
	const canRead = perms.has('admin:access') || perms.has('order:read');
	if (!canRead) return <p className="text-sm text-red-600">No autorizado.</p>;
	const canManage = perms.has('admin:access') || perms.has('order:manageStatus');

	const order = await prisma.order.findUnique({
		where: { id: params.id },
		include: { items: true, user: { select: { id: true, email: true } } }
	});
	if (!order) return <p className="text-sm text-neutral-600">Pedido no encontrado.</p>;
	// Ganancia del pedido: precio de venta menos el costo que tenía cada producto cuando se vendió.
	const hasCost = order.items.some(i => Number(i.unitCost) > 0);
	const profit = order.items.reduce((s, i) => Number(i.unitCost) > 0 ? s + (Number(i.unitPrice) - Number(i.unitCost)) * i.quantity : s, 0);

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Pedido <span className="font-mono text-base text-neutral-500">#{order.id.slice(0,8)}</span></h1>
					<p className="text-sm text-neutral-600">Detalle completo del pedido y cambio de estado.</p>
				</div>
				<Link href="/admin/orders" className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border rounded-md border-neutral-300 bg-white hover:bg-neutral-50">← Volver</Link>
			</header>
			<div className="grid gap-6 md:grid-cols-3">
				{/* Resumen */}
				<div className="p-4 space-y-3 bg-white/90 border rounded-md shadow-sm md:col-span-2">
					<h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-500">Resumen</h2>
					<dl className="grid grid-cols-3 gap-2 text-sm">
						<dt className="text-neutral-500">ID</dt>
						<dd className="max-w-full col-span-2 font-mono break-all">{order.id}</dd>
						<dt className="text-neutral-500">Estado</dt>
						<dd className="col-span-2"><span className="px-2 py-1 text-[11px] rounded bg-neutral-800 text-white tracking-wide">{order.status}</span></dd>
						<dt className="text-neutral-500">Cliente</dt>
						<dd className="max-w-full col-span-2 truncate">{order.customer}</dd>
						<dt className="text-neutral-500">Email</dt>
						<dd className="max-w-full col-span-2 text-xs leading-snug break-words break-all">{order.email}</dd>
						<dt className="text-neutral-500">Teléfono</dt>
						<dd className="col-span-2 break-words">{order.phone}</dd>
						<dt className="text-neutral-500">Dirección</dt>
						<dd className="col-span-2 whitespace-pre-line break-words break-all leading-snug text-[13px]">{order.address}</dd>
						<dt className="text-neutral-500">Subtotal</dt>
						<dd className="col-span-2">{formatCurrency(Number(order.subtotal))}</dd>
						<dt className="text-neutral-500">Total</dt>
						<dd className="col-span-2 font-semibold text-carrot-dark">{formatCurrency(Number(order.total))}</dd>
						<dt className="text-neutral-500">Ganancia</dt>
							<dd className="col-span-2 text-sm font-semibold text-green-700" title="Ventas menos el costo registrado al momento de la compra">{hasCost ? formatCurrency(profit) : <span className="font-normal text-neutral-400">Sin costo registrado</span>}</dd>
							<dt className="text-neutral-500">Fecha</dt>
						<dd className="col-span-2 text-xs">{order.createdAt.toISOString().slice(0,16).replace('T',' ')}</dd>
						{order.user && (
							<>
								<dt className="text-neutral-500">Usuario</dt>
								<dd className="col-span-2 text-xs break-words break-all">{order.user.email}</dd>
							</>
						)}
					</dl>
					<div className="pt-4 space-y-3">
						<h3 className="text-xs font-semibold tracking-wide uppercase text-neutral-500">Items ({order.items.length})</h3>
						{/* Mobile list */}
						<ul className="overflow-hidden border divide-y rounded md:hidden border-neutral-200">
							{order.items.map(i => {
								const unit = Number(i.unitPrice);
								return (
									<li key={i.id} className="flex flex-col gap-2 px-4 py-3 text-sm bg-white/60">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="font-medium leading-tight truncate">{i.name}</p>
												<p className="text-[11px] text-neutral-500 truncate">{i.slug}</p>
											</div>
											<p className="font-mono text-xs text-right text-neutral-500">x{i.quantity}</p>
										</div>
										<div className="flex justify-between gap-4 text-xs">
											<span className="text-neutral-500">Unit: <strong className="font-medium text-neutral-700">{formatCurrency(unit)}</strong></span>
											<span className="ml-auto">Total: <strong className="font-semibold text-neutral-800">{formatCurrency(unit * i.quantity)}</strong></span>
										</div>
									</li>
								);
							})}
						</ul>
						{/* Desktop table */}
						<div className="hidden overflow-auto border rounded-md md:block max-h-96 border-neutral-200">
							<table className="w-full text-sm min-w-[520px]">
								<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
									<tr>
										<th className="px-3 py-2 text-left">Producto</th>
										<th className="px-3 py-2 text-left">Slug</th>
										<th className="px-3 py-2 text-right">Cant</th>
										<th className="px-3 py-2 text-right">Unit</th>
										<th className="px-3 py-2 text-right">Importe</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{order.items.map(i => {
										const unit = Number(i.unitPrice);
										return (
											<tr key={i.id} className="hover:bg-neutral-50">
												<td className="px-3 py-2">{i.name}</td>
												<td className="px-3 py-2 text-xs text-neutral-500">{i.slug}</td>
												<td className="px-3 py-2 text-right">{i.quantity}</td>
												<td className="px-3 py-2 text-right">{formatCurrency(unit)}</td>
												<td className="px-3 py-2 font-medium text-right">{formatCurrency(unit * i.quantity)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
				{/* Estado / acciones */}
				<aside className="space-y-6 p-4 border rounded-md bg-white/90 shadow-sm h-fit">
					<div className="space-y-3">
						<h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-500">Estado</h2>
						<p className="text-sm font-mono"><span className="px-2 py-1 rounded bg-neutral-800 text-white text-[11px] tracking-wide">{order.status}</span></p>
						<AdminOrderStatusControls orderId={order.id} current={order.status as any} canManage={canManage} />
					</div>
				</aside>
			</div>
		</div>
	);
}
