"use client";
import { useState, useMemo, useEffect, useRef } from 'react';

// Static import of Recharts; gated by mount flag to avoid hydration mismatch
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Legend, BarChart, Bar, ComposedChart, ReferenceLine } from 'recharts';

export function RevenueOrdersChart({ data }: { data: { date: string; revenue: number; orders: number; }[] }) {
  const [mode, setMode] = useState<'revenue'|'orders'>('revenue');
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); }, []);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-1">
          <button onClick={()=>setMode('revenue')} className={`px-2 py-1 rounded border transition ${mode==='revenue'? 'bg-carrot text-nav border-carrot':'bg-white hover:bg-neutral-50'}`}>Ingresos</button>
          <button onClick={()=>setMode('orders')} className={`px-2 py-1 rounded border transition ${mode==='orders'? 'bg-carrot text-nav border-carrot':'bg-white hover:bg-neutral-50'}`}>Pedidos</button>
        </div>
        <p className="text-[11px] text-neutral-400">{mode==='revenue'? 'Suma total por intervalo':'Nº pedidos por intervalo'}</p>
      </div>
  <div className="w-full h-64 chart-body">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 10, bottom: 4 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v:any)=> mode==='revenue'? formatCurrency(Number(v)) : v } labelFormatter={(l:any)=> `Fecha: ${l}`} />
              <Line type="monotone" strokeWidth={2} dataKey={mode} stroke={mode==='revenue'? '#F58220':'#111827'} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function formatCurrency(n: number) { return new Intl.NumberFormat('es-GT',{ style: 'currency', currency: 'GTQ'}).format(n); }

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse flex items-center justify-center text-[11px] text-neutral-400 bg-neutral-50 rounded">Cargando…</div>;
}

export function OrderStatusChart({ data }: { data: { date: string; PENDING: number; PAID: number; SHIPPED: number; COMPLETED: number; CANCELED: number; }[] }) {
  const palette = {
    PENDING: '#9CA3AF',
    PAID: '#3B82F6',
    SHIPPED: '#F59E0B',
    COMPLETED: '#10B981',
    CANCELED: '#EF4444'
  } as const;
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const [w,setW] = useState(0);
  useEffect(()=> { setMounted(true); }, []);
  useEffect(()=> {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    obs.observe(wrapRef.current);
    return ()=> obs.disconnect();
  }, []);
  const isNarrow = !!(w && w < 620);
  const isUltraNarrow = !!(w && w < 380);
  const axisWidth = isUltraNarrow ? 32 : isNarrow ? 40 : 50;
  const chartMargin = isUltraNarrow
    ? { left: 0, right: 4, top: 4, bottom: 0 }
    : isNarrow
      ? { left: 2, right: 6, top: 6, bottom: 2 }
      : { left:4, right:12, top:10, bottom:4 };
  // Cálculo dinámico de intervalo de ticks (evita amontonamiento en escritorio con series largas)
  const [tickInterval, setTickInterval] = useState(0);
  useEffect(()=> {
    if (!w || !data.length) return;
    const desiredMinSpace = 54; // px por tick
    const maxTicks = Math.max(2, Math.floor(w / desiredMinSpace));
    if (data.length <= maxTicks) { setTickInterval(0); return; }
    const interval = Math.max(1, Math.ceil(data.length / maxTicks) - 1);
    setTickInterval(interval);
  }, [w, data]);
  const stacked = useMemo(()=> data.map(d=> ({
    date: d.date,
    PENDING: d.PENDING,
    PAID: d.PAID,
    SHIPPED: d.SHIPPED,
    COMPLETED: d.COMPLETED,
    CANCELED: d.CANCELED,
    total: d.PENDING + d.PAID + d.SHIPPED + d.COMPLETED + d.CANCELED
  })), [data]);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Estados de pedidos</h3>
        <span className="text-[10px] text-neutral-400">Stacked</span>
      </div>
    <div ref={wrapRef} className="chart-body h-[340px] sm:h-64 w-full px-1">{/* px para que no se corte borde en móviles */}
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stacked} margin={chartMargin}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: isUltraNarrow? 9 : 11 }}
                tickMargin={4}
                interval={tickInterval}
                minTickGap={8}
                tickFormatter={(d:any)=> (isNarrow? String(d).slice(5) : d)}
              />
              <YAxis tick={{ fontSize: isUltraNarrow? 9 : 11 }} width={axisWidth} hide={isUltraNarrow} />
              <Tooltip labelFormatter={(l:any)=> `Fecha: ${l}`} formatter={(val:any, name:any)=> [val, name]} />
              {!isUltraNarrow && <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={28} />}
              <Area type="monotone" dataKey="PENDING" stackId="1" stroke={palette.PENDING} fill={palette.PENDING} fillOpacity={0.35} />
              <Area type="monotone" dataKey="PAID" stackId="1" stroke={palette.PAID} fill={palette.PAID} fillOpacity={0.35} />
              <Area type="monotone" dataKey="SHIPPED" stackId="1" stroke={palette.SHIPPED} fill={palette.SHIPPED} fillOpacity={0.35} />
              <Area type="monotone" dataKey="COMPLETED" stackId="1" stroke={palette.COMPLETED} fill={palette.COMPLETED} fillOpacity={0.35} />
              <Area type="monotone" dataKey="CANCELED" stackId="1" stroke={palette.CANCELED} fill={palette.CANCELED} fillOpacity={0.45} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function RevenueUnitsBarChart({ data }: { data: { date: string; revenue: number; units: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Ingresos vs Unidades</h3>
        <span className="text-[10px] text-neutral-400">Barras comparativas</span>
      </div>
  <div className="w-full h-64 chart-body">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left:4, right:8, top:10, bottom:4 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" hide={data.length>20} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={50} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize:10 }} width={40} />
              <Tooltip formatter={(v:any, key:any)=> key==='revenue'? formatCurrency(Number(v)) : v } labelFormatter={(l:any)=> `Fecha: ${l}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Ingresos" fill="#F58220" radius={[3,3,0,0]} />
              <Bar yAxisId="right" dataKey="units" name="Unidades" fill="#111827" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function UserGrowthChart({ data }: { data: { date: string; newUsers: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Nuevos usuarios</h3>
        <span className="text-[10px] text-neutral-400">Evolución</span>
      </div>
  <div className="w-full h-64 chart-body">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left:4, right:8, top:10, bottom:4 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide={data.length>25} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip labelFormatter={(l:any)=> `Fecha: ${l}`} />
              <Area type="monotone" dataKey="newUsers" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Cumulative revenue evolution (área + línea)
export function CumulativeRevenueChart({ data }: { data: { date: string; revenue: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  const cum = useMemo(()=> {
    let acc = 0; return data.map(p => { acc += p.revenue; return { date: p.date, cumulative: acc }; });
  }, [data]);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Ingresos acumulados</h3>
        <span className="text-[10px] text-neutral-400">Crecimiento</span>
      </div>
  <div className="w-full h-64 chart-body">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cum} margin={{ left:4, right:8, top:10, bottom:4 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide={cum.length>25} />
              <YAxis tick={{ fontSize: 10 }} width={60} />
              <Tooltip formatter={(v:any)=> formatCurrency(Number(v))} labelFormatter={(l:any)=> `Fecha: ${l}`} />
              <Area type="monotone" dataKey="cumulative" stroke="#F58220" fill="#F58220" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Cancel rate over time (línea simple)
export function CancelRateChart({ data }: { data: { date: string; PENDING: number; PAID: number; SHIPPED: number; COMPLETED: number; CANCELED: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  const rateData = useMemo(()=> data.map(p => {
    const total = p.PENDING + p.PAID + p.SHIPPED + p.COMPLETED + p.CANCELED || 1;
    return { date: p.date, cancelRate: (p.CANCELED / total) * 100 };
  }), [data]);
  return (
  <div className="min-w-0 p-4 space-y-3 overflow-visible border rounded-lg shadow-sm bg-white/90 chart-card">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">% Cancelados</h3>
        <span className="text-[10px] text-neutral-400">Tendencia</span>
      </div>
  <div className="w-full h-64 chart-body">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData} margin={{ left:4, right:8, top:10, bottom:4 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide={rateData.length>25} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip formatter={(v:any)=> (Number(v)).toFixed(2)+ '%'} labelFormatter={(l:any)=> `Fecha: ${l}`} />
              <Line type="monotone" dataKey="cancelRate" stroke="#EF4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Horizontal bar for top productos (ingresos)
export function TopProductsBarChart({ products }: { products: { name: string; revenue: number; units: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  const data = products.slice(0,8).map(p => ({ ...p }));
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const [w,setW] = useState(0);
  useEffect(()=> {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    obs.observe(wrapRef.current);
    return ()=> obs.disconnect();
  }, []);
  const isNarrow = !!(w && w < 520);
  const isVeryNarrow = !!(w && w < 360);
  const yWidth = isNarrow ? 70 : 90; // un poco más para no truncar nombres
  const margin = isNarrow ? { left: yWidth + 10, right: 8, top: 10, bottom: 4 } : { left: yWidth + 20, right: 12, top: 10, bottom: 4 };
  return (
    <div className="min-w-0 p-4 space-y-3 border rounded-lg shadow-sm bg-white/90">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Top productos (ingresos)</h3>
        <span className="text-[10px] text-neutral-400">Top 8</span>
      </div>
    <div ref={wrapRef} className="chart-body h-[340px] sm:h-64">
        {!mounted ? <ChartSkeleton /> : isVeryNarrow ? (
          <div className="flex flex-col gap-2 overflow-auto text-[11px] pr-1">
            {data.map(p => (
              <div key={p.name} className="flex items-center justify-between gap-3 py-1 border-b last:border-0">
                <span className="flex-1 truncate" title={p.name}>{p.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={margin}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'dataMax + 8']} tickFormatter={(v)=> (v>1000? (v/1000).toFixed(1)+'k': v)} />
              <YAxis dataKey="name" type="category" width={yWidth} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v:any)=> formatCurrency(Number(v))} />
              <Bar dataKey="revenue" name="Ingresos" fill="#F58220" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Pareto chart for top products: bars = revenue, line = cumulative % of revenue.
export function TopProductsParetoChart({ products }: { products: { name: string; revenue: number; units: number; }[] }) {
  const [mounted, setMounted] = useState(false); useEffect(()=> setMounted(true), []);
  const data = products.slice(0, 20).map(p => ({ ...p }));
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const [w,setW] = useState(0);
  useEffect(()=> {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    obs.observe(wrapRef.current);
    return ()=> obs.disconnect();
  }, []);
  const isNarrow = !!(w && w < 640);
  const total = data.reduce((a,b)=> a + b.revenue, 0) || 1;
  let acc = 0;
  const enriched = data.map(d => { acc += d.revenue; return { ...d, cumulative: (acc/total)*100 }; });
  const thresholdIndex = enriched.findIndex(d => d.cumulative >= 80); // first reaching 80%
  const axisMargin = isNarrow ? { left: 10, right: 40, top: 10, bottom: 4 } : { left: 20, right: 50, top: 10, bottom: 8 };
  return (
    <div className="p-4 border rounded-lg bg-white/90 shadow-sm space-y-3 min-w-0">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Pareto productos</h3>
        <span className="text-[10px] text-neutral-400">80/20</span>
      </div>
      <div ref={wrapRef} className="chart-body h-[340px] sm:h-64">
        {!mounted ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={axisMargin}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={isNarrow? -35:0} textAnchor={isNarrow? 'end':'middle'} height={isNarrow? 70: undefined} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={isNarrow? 50:60} tickFormatter={(v)=> (v>1000? (v/1000).toFixed(1)+'k': v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={36} domain={[0,100]} tickFormatter={(v)=> v + '%'} />
              <Tooltip formatter={(v:any, key:any, p:any)=> key==='cumulative'? (Number(v).toFixed(1)+'%'): formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine yAxisId="right" y={80} stroke="#EF4444" strokeDasharray="4 3" />
              <Bar yAxisId="left" dataKey="revenue" name="Ingresos" fill="#F58220" radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" name="% acumulado" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
        {thresholdIndex >=0 ? (
          <span className="px-2 py-0.5 rounded bg-carrot/20 border border-carrot/40 font-medium">
            80% ingresos: {thresholdIndex+1} prod. ({enriched[thresholdIndex].cumulative.toFixed(1)}%)
          </span>
        ): (
          <span className="px-2 py-0.5 rounded bg-neutral-100 border font-medium">No alcanza 80%</span>
        )}
        <span className="text-[10px] text-neutral-400">Total {data.length} productos considerados</span>
      </div>
    </div>
  );
}
