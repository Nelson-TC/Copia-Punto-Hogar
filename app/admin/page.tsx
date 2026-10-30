import { normalizeRange, getSummaryMetrics, getTimeSeries, getTopProducts, getCategoryDistribution, getOrderStatusBreakdown, previousRange, getRecentOrders, getOrderStatusTotals, getUserSeries } from '@/lib/metrics';
import { formatCurrency } from '@/lib/format';
import { DashboardFilters } from '../../components/dashboard/DashboardFilters';
import { RevenueOrdersChart, OrderStatusChart, RevenueUnitsBarChart, UserGrowthChart, CumulativeRevenueChart, CancelRateChart, TopProductsBarChart, TopProductsParetoChart } from '../../components/dashboard/Charts';
import { DenseModeToggle } from '../../components/dashboard/DenseModeToggle';
import { CategoryDistribution } from '../../components/dashboard/CategoryDistribution';
import { ExportMenu } from '../../components/dashboard/ExportMenu';
import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({ searchParams }: { searchParams: Record<string,string|undefined> }) {

	const range = normalizeRange({ from: searchParams.from, to: searchParams.to, g: searchParams.g });
	const prev = previousRange(range);
	const [summary, prevSummary, series, userSeries, topProducts, categories, statusBreakdown, recentOrders, statusTotals] = await Promise.all([
		getSummaryMetrics(range),
		getSummaryMetrics(prev),
		getTimeSeries(range),
		getUserSeries(range),
		getTopProducts(range, 5),
		getCategoryDistribution(range),
		getOrderStatusBreakdown(range),
		getRecentOrders(range, 8),
		getOrderStatusTotals(range)
	]);

	return (
		<div className="px-0 space-y-8 overflow-x-hidden lg:px-0">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-1">
					<h1 className="text-3xl font-bold tracking-tight">Panel de control</h1>
					<p className="text-sm text-neutral-600">Resumen del desempeño ({summary.range.from} → {summary.range.to}).</p>
				</div>
				<div className="flex items-center gap-3">
					<DenseModeToggle />
					<DateRangeBadge from={summary.range.from} to={summary.range.to} granularity={summary.range.granularity} />
				</div>
			</header>

			<div className="flex flex-col gap-5">
				<DashboardFilters />
				<KpiGrid summary={summary} previous={prevSummary} />
			</div>

			<section className="space-y-3" aria-labelledby="tendencia-heading">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h2 id="tendencia-heading" className="text-sm font-semibold tracking-wide uppercase text-neutral-600">Tendencia</h2>
					<div className="flex flex-wrap items-center gap-3">
						<Link href="/admin?g=week" className="text-xs text-carrot hover:underline">Ver por semana</Link>
						<ExportMenu kinds={[
							{ key: 'summary', label: 'Resumen' },
							{ key: 'timeseries', label: 'Serie temporal' },
							{ key: 'top-products', label: 'Top productos' },
							{ key: 'categories', label: 'Categorías' },
							{ key: 'orders-status', label: 'Estados pedidos' }
						]} />
					</div>
				</div>
				{/* Layout ancho: máximo 2 charts por fila en XL para evitar columnas muy angostas */}
				<div className="grid gap-3 xl:grid-cols-12">
					{/* Fila 1: Serie principal + estado/actualización */}
					<div className="col-span-12 xl:col-span-8"><RevenueOrdersChart data={series} /></div>
					<div className="flex flex-col col-span-12 gap-4 sm:col-span-6 xl:col-span-4">
						<StatusRadial statusTotals={statusTotals} />
						<UpdateCard summary={summary} prev={prevSummary} />
					</div>
					{/* Fila 2: Comparativas y acumulados */}
					<div className="col-span-12 md:col-span-6 xl:col-span-6"><RevenueUnitsBarChart data={series} /></div>
					<div className="col-span-12 md:col-span-6 xl:col-span-6"><CumulativeRevenueChart data={series} /></div>
					{/* Fila 3: Crecimiento usuarios + cancel rate */}
					<div className="col-span-12 md:col-span-6 xl:col-span-6"><UserGrowthChart data={userSeries} /></div>
					<div className="col-span-12 md:col-span-6 xl:col-span-6"><CancelRateChart data={statusBreakdown} /></div>
				</div>
			</section>
			<section className="grid gap-3 xl:grid-cols-12" aria-labelledby="detalle-heading">
				<h2 id="detalle-heading" className="sr-only">Detalle complementario</h2>
				{/* Izquierda: Pareto + Estados (más alto valor analítico) */}
				<div className="flex flex-col gap-3 xl:col-span-8 2xl:col-span-9">
					<TopProductsParetoChart products={topProducts} />
					<OrderStatusChart data={statusBreakdown} />
				</div>
				{/* Derecha: Pedidos recientes + Donut compacto */}
				<div className="flex flex-col gap-3 xl:col-span-4 2xl:col-span-3">
					<RecentOrdersList orders={recentOrders} />
					<CategoryDistribution data={categories} compact />
				</div>
			</section>

			<section className="space-y-4" aria-labelledby="top-heading">
				<div className="flex items-center justify-between">
					<h2 id="top-heading" className="text-sm font-semibold tracking-wide uppercase text-neutral-600">Productos destacados</h2>
					<Link href="/admin?limit=10" className="text-xs text-carrot hover:underline">Ver más</Link>
				</div>
				<TopProductsTable products={topProducts} />
			</section>
		</div>
	);
}

// ------- Dashboard Subcomponents (corporate style add-ons) ---------

function StatusRadial({ statusTotals }: { statusTotals: any }) {
	const segs = [
		{ key:'COMPLETED', color:'#10B981', label:'Completados' },
		{ key:'PAID', color:'#3B82F6', label:'Pagados' },
		{ key:'SHIPPED', color:'#F59E0B', label:'Enviados' },
		{ key:'PENDING', color:'#9CA3AF', label:'Pendientes' },
		{ key:'CANCELED', color:'#EF4444', label:'Cancelados' }
	];
	const total = statusTotals.total || 1;
	return (
		<div className="flex flex-col gap-4 p-4 border rounded-lg shadow-sm bg-white/90">
			<p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">Estado global</p>
			<div className="flex items-center gap-6">
				<div className="relative w-32 h-32">
					<svg viewBox="0 0 42 42" className="w-full h-full">
						<circle cx="21" cy="21" r="15.915" fill="white" stroke="#eee" strokeWidth="2" />
						{(() => {
							let acc = 0; return segs.map(s => {
								const value = statusTotals[s.key] || 0; const pct = value / total; const start = acc; acc += pct;
								const strokeDasharray = `${(pct*100).toFixed(2)} ${(100 - pct*100).toFixed(2)}`; const rotation = start * 360;
								return <circle key={s.key} cx="21" cy="21" r="15.915" fill="transparent" stroke={s.color} strokeWidth="4" strokeDasharray={strokeDasharray} strokeDashoffset="25" style={{ transform: `rotate(${rotation}deg)`, transformOrigin:'center' }} />;
							});
						})()}
						<text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="text-[8px] fill-neutral-700 font-semibold">{total}</text>
					</svg>
				</div>
				<ul className="flex-1 space-y-1 text-[11px]">
					{segs.map(s => {
						const v = statusTotals[s.key] || 0; const pct = total ? (v/total*100).toFixed(1) : '0.0';
						return <li key={s.key} className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background:s.color }} /> <span className="flex-1 truncate">{s.label}</span><span className="font-medium tabular-nums text-neutral-700">{pct}%</span></li>;
					})}
				</ul>
			</div>
		</div>
	);
}

function UpdateCard({ summary, prev }: { summary: any; prev: any }) {
	const revDelta = summary.totals.revenue - prev.totals.revenue;
	const pct = prev.totals.revenue ? (revDelta / prev.totals.revenue)*100 : 100;
	const positive = revDelta >= 0;
	return (
		<div className="flex flex-col gap-3 p-5 border rounded-lg shadow-sm bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700 text-neutral-50">
			<span className="text-[10px] uppercase tracking-wide font-semibold text-carrot">Actualización</span>
			<h3 className="text-sm font-medium leading-snug">Ingresos {positive? 'aumentaron':'disminuyeron'} {Math.abs(pct).toFixed(1)}% vs. periodo anterior</h3>
			<p className="text-2xl font-bold tabular-nums">{formatCurrency(summary.totals.revenue)}</p>
			<p className="text-[11px] text-neutral-300">{summary.range.from} → {summary.range.to}</p>
		</div>
	);
}

function RecentOrdersList({ orders }: { orders: any[] }) {
	const counts = orders.reduce((acc:any,o:any)=> { acc.total++; acc[o.status]=(acc[o.status]||0)+1; return acc; }, { total:0 });
	return (
		<div className="flex flex-col min-w-0 gap-3 p-4 border rounded-lg shadow-sm bg-white/90">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col">
					<p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">Pedidos recientes</p>
					{counts.total>0 && (
						<p className="flex flex-wrap gap-2 mt-1 text-[10px] text-neutral-500">
							<span><strong className="text-neutral-700">{counts.total}</strong> totales</span>
							{['COMPLETED','PAID','PENDING','CANCELED'].map(s=> counts[s] ? (
								<span key={s} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${statusDotColor(s)}`} />{s.toLowerCase()}: {counts[s]}</span>
							): null)}
						</p>
					)}
				</div>
				<Link href="/admin/orders" className="self-start text-[11px] text-carrot hover:underline whitespace-nowrap">Ver todos</Link>
			</div>
			{orders.length === 0 && <p className="text-xs text-neutral-500">Sin pedidos en el rango.</p>}
			<ul className="flex flex-col divide-y">
				{orders.map(o => {
					const age = relativeTime(o.createdAt);
					return (
						<li key={o.id}>
							<Link href={`/admin/orders/${o.id}`} className="flex flex-col gap-1 py-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50">
								<div className="flex items-center gap-2">
									<span className={`w-1.5 h-6 rounded-full ${statusBarColor(o.status)} group-hover:opacity-80`} aria-hidden />
									<span className="font-mono text-[11px] text-neutral-600 group-hover:text-neutral-900 tracking-tight">{o.id.slice(0,8)}</span>
									<span className="ml-auto text-sm font-medium transition-colors tabular-nums text-neutral-900 group-hover:text-carrot-dark">{formatCurrency(o.total)}</span>
								</div>
								<div className="flex items-center gap-2 pl-4 text-[10px] text-neutral-500">
									<span className={`px-1.5 py-0.5 rounded-md border ${badgeTone(o.status)}`}>{o.status}</span>
									<span className="tracking-wide uppercase text-neutral-400">{o.items} ítem{o.items===1?'':'s'}</span>
									{age && <span className="ml-auto font-mono text-[10px] text-neutral-400">{age}</span>}
								</div>
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function relativeTime(raw: any) {
	try {
		if (!raw) return '';
		const d = new Date(raw);
		if (isNaN(d.getTime())) return '';
		const now = Date.now();
		const diff = Math.floor((now - d.getTime())/1000); // seconds
		if (diff < 60) return diff + 's';
		if (diff < 3600) return Math.floor(diff/60)+'m';
		if (diff < 86400) return Math.floor(diff/3600)+'h';
		const days = Math.floor(diff/86400);
		return days + 'd';
	} catch { return ''; }
}

function statusDotColor(s: string) {
	switch(s) {
		case 'COMPLETED': return 'bg-emerald-500';
		case 'PAID': return 'bg-blue-500';
		case 'SHIPPED': return 'bg-amber-500';
		case 'PENDING': return 'bg-neutral-400';
		case 'CANCELED': return 'bg-red-500';
		default: return 'bg-neutral-300';
	}
}
function statusBarColor(s: string) {
	switch(s) {
		case 'COMPLETED': return 'bg-emerald-400';
		case 'PAID': return 'bg-blue-400';
		case 'SHIPPED': return 'bg-amber-400';
		case 'PENDING': return 'bg-neutral-300';
		case 'CANCELED': return 'bg-red-400';
		default: return 'bg-neutral-300';
	}
}
function badgeTone(s: string) {
	switch(s) {
		case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		case 'PAID': return 'bg-blue-50 text-blue-700 border-blue-200';
		case 'SHIPPED': return 'bg-amber-50 text-amber-700 border-amber-200';
		case 'PENDING': return 'bg-neutral-50 text-neutral-600 border-neutral-200';
		case 'CANCELED': return 'bg-red-50 text-red-600 border-red-200';
		default: return 'bg-neutral-50 text-neutral-600 border-neutral-200';
	}
}

function badgeColor(status: string) {
	switch(status) {
		case 'COMPLETED': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
		case 'PAID': return 'bg-blue-100 text-blue-700 border border-blue-200';
		case 'SHIPPED': return 'bg-amber-100 text-amber-700 border border-amber-200';
		case 'PENDING': return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
		case 'CANCELED': return 'bg-red-100 text-red-700 border border-red-200';
		default: return 'bg-neutral-100 text-neutral-600 border';
	}
}

function DateRangeBadge({ from, to, granularity }: { from: string; to: string; granularity: string }) {
	return (
		<div className="flex items-center gap-3 px-3 py-2 text-xs bg-white border rounded-md shadow-sm">
			<span className="font-mono">{from}</span>
			<span className="text-neutral-400">→</span>
			<span className="font-mono">{to}</span>
			<span className="ml-2 px-2 py-0.5 rounded bg-neutral-100 border text-[10px] font-medium tracking-wide uppercase">{granularity}</span>
		</div>
	);
}

function KpiGrid({ summary, previous }: { summary: any; previous: any }) {
	const { totals, users, orders } = summary;
	const ps = previous;
	function delta(curr: number, prev: number) {
		if (prev === 0 && curr === 0) return { diff: 0, pct: 0, state:'flat' };
		if (prev === 0) return { diff: curr, pct: 100, state:'new' };
		const pct = ((curr - prev)/prev)*100;
		return { diff: curr - prev, pct, state: pct>0? 'up': pct<0? 'down':'flat' };
	}
	const cards = [
		{ key:'revenue', label: 'Ingresos', hint:'Total de ingresos (bruto) del periodo.', value: totals.revenue, prev: ps.totals.revenue, fmt: formatCurrency },
		{ key:'profit', label: 'Ganancia', hint:'Ventas menos el costo de lo vendido. Solo pedidos no cancelados y productos con costo registrado.', value: totals.profit, prev: ps.totals.profit, fmt: formatCurrency },
		{ key:'margin', label: 'Margen %', hint:'Ganancia / ventas (margen sobre el precio de venta).', value: totals.profitMarginPct * 100, prev: ps.totals.profitMarginPct * 100, fmt: (n:number)=> n.toFixed(1)+'%' },
		{ key:'orders', label: 'Pedidos', hint:'Número de pedidos creados.', value: totals.orders, prev: ps.totals.orders },
		{ key:'aov', label: 'Ticket medio', hint:'Ingresos / pedidos.', value: totals.aov, prev: ps.totals.aov, fmt: formatCurrency },
		{ key:'units', label: 'Unidades', hint:'Suma de cantidades vendidas.', value: totals.units, prev: ps.totals.units },
		{ key:'newUsers', label: 'Nuevos usuarios', hint:'Usuarios registrados en el periodo.', value: users.newUsers, prev: ps.users.newUsers },
		{ key:'buyers', label: 'Compradores', hint:'Usuarios con ≥1 compra en el periodo.', value: users.buyers, prev: ps.users.buyers },
		{ key:'repeat', label: 'Recompradores', hint:'Compradores con más de un pedido.', value: users.repeat, prev: ps.users.repeat },
		{ key:'canceled', label: 'Cancelados %', hint:'Pedidos cancelados / pedidos.', value: orders.canceledPct * 100, prev: ps.orders.canceledPct * 100, fmt: (n:number)=> n.toFixed(1)+'%' },
		{ key:'conversion', label: 'Conversión', hint:'Pedidos / compradores (aprox).', value: users.buyers? totals.orders / users.buyers : 0, prev: ps.users.buyers? ps.totals.orders/ps.users.buyers : 0, fmt: (n:number)=> (n*100).toFixed(1)+'%' },
		{ key:'repeatRate', label: 'Recompra %', hint:'Recompradores / compradores.', value: users.buyers? users.repeat/users.buyers : 0, prev: ps.users.buyers? ps.users.repeat/ps.users.buyers : 0, fmt: (n:number)=> (n*100).toFixed(1)+'%' },
	];
	return (
		<section>
			<div className="grid gap-4 kpi-grid">
				{cards.map(c => <KpiCard key={c.key} label={c.label} hint={c.hint} value={c.fmt ? c.fmt(c.value) : (Number.isFinite(c.value)? c.value : '—')} deltaInfo={delta(c.value, c.prev)} format={c.fmt} />)}
			</div>
		</section>
	);
}

function KpiCard({ label, hint, value, deltaInfo, format }: { label: string; hint: string; value: any; deltaInfo: { diff:number; pct:number; state:string }; format?: (n:number)=>string }) {
	const { state, pct, diff } = deltaInfo;
	const color = state==='up'? 'text-emerald-600': state==='down'? 'text-red-600':'text-neutral-400';
	// Color backgrounds by metric type (simple heuristic by label)
	const tone = label.startsWith('Ing')? 'bg-orange-50 border-orange-200': label.startsWith('Gan')? 'bg-green-50 border-green-200': label.startsWith('Margen')? 'bg-teal-50 border-teal-200': label.startsWith('Ped')? 'bg-blue-50 border-blue-200': label.startsWith('Ticket')? 'bg-amber-50 border-amber-200': label.startsWith('Uni')? 'bg-lime-50 border-lime-200': label.startsWith('Nuevos')? 'bg-sky-50 border-sky-200': label.startsWith('Comp')? 'bg-violet-50 border-violet-200': label.startsWith('Recom')? 'bg-emerald-50 border-emerald-200': label.startsWith('Cancel')? 'bg-rose-50 border-rose-200': label.startsWith('Convers')? 'bg-cyan-50 border-cyan-200': label.startsWith('Recompra')? 'bg-fuchsia-50 border-fuchsia-200':'bg-white/90';
	const arrow = state==='up'? '▲': state==='down'? '▼':'●';
	const showChange = state!=='flat' && state!=='new';
	return (
		<div className={`relative flex flex-col gap-1 p-4 overflow-hidden border rounded-lg shadow-sm group min-h-[140px] ${tone}`} title={hint} aria-label={label + '. ' + hint}>
			<p className="text-[11px] uppercase tracking-wide text-neutral-500 font-medium flex items-center gap-2">
				<span>{label}</span>
				<span className={`text-[10px] font-semibold flex items-center gap-1 ${color}`}>{arrow}{state==='new'? ' Nuevo' : ` ${Math.abs(pct).toFixed(1)}%`}</span>
			</p>
			<p className="text-xl font-semibold tabular-nums text-nav">{value}</p>
			{state==='new' && <p className="text-[10px] text-neutral-400">Sin periodo previo comparable.</p>}
			{showChange && <p className="text-[10px] text-neutral-400 tabular-nums">Cambio {format? (diff>=0? '+':'') + format(diff) : (diff>=0? '+':'') + diff.toFixed(2)}</p>}
		</div>
	);
}

function TimeSeriesPlaceholder({ series }: { series: any[] }) {
	return (
		<div className="p-4 space-y-3 border rounded-lg shadow-sm bg-white/90">
			<div className="grid gap-2 text-[11px] text-neutral-500" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))' }}>
				{series.slice(-14).map(p => (
					<div key={p.date} className="flex flex-col gap-1 p-2 border rounded bg-white/60">
						<span className="font-mono text-[10px] text-neutral-500">{p.date}</span>
						<span className="text-xs font-semibold">{formatCurrency(p.revenue)}</span>
						<span className="text-[10px]">{p.orders} pedidos</span>
					</div>
				))}
			</div>
			<p className="text-[11px] text-neutral-400">(Placeholder) Próximamente gráfico interactivo.</p>
		</div>
	);
}

function TopProductsTable({ products }: { products: any[] }) {
	if (!products.length) return <p className="text-sm text-neutral-500">Sin datos.</p>;
	return (
		<div className="overflow-auto border rounded-lg bg-white/90 max-h-80">
			<table className="w-full text-sm">
				<thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
					<tr>
						<th className="px-3 py-2 text-left">Producto</th>
						<th className="px-3 py-2 text-right">Ingresos</th>
						<th className="px-3 py-2 text-right">Unidades</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{products.map(p => (
						<tr key={p.productId} className="hover:bg-neutral-50">
							<td className="px-3 py-2 text-xs font-medium">{p.name}</td>
							<td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.revenue)}</td>
							<td className="px-3 py-2 text-right tabular-nums">{p.units}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// local formatCurrency removed in favor of shared helper
