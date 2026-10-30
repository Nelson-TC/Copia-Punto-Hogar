"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#123453','#F58220','#55A844','#3F4145','#F9A85F','#8BC47F'];

interface CatData { name: string; revenue: number; units: number; }

export function CategoryDistribution({ data, compact = false }: { data: CatData[]; compact?: boolean }) {
  const total = data.reduce((a,b)=> a + b.revenue, 0) || 1;
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement|null>(null);
  const expandedWrapperRef = useRef<HTMLDivElement|null>(null);
  const [radius,setRadius] = useState({ inner:40, outer:90 });
  const [expanded,setExpanded] = useState(false); // sólo aplica si compact=true
  useEffect(()=> setMounted(true), []);
  useEffect(()=> {
    const targetRef = expanded ? expandedWrapperRef : wrapperRef;
    if (!targetRef.current) return;
    function recalc() {
      if (!targetRef.current) return;
      const { width, height } = targetRef.current.getBoundingClientRect();
      // Compact (thumbnail donut)
      if (compact && !expanded) {
        const basis = Math.min(width, height || width);
        const outer = Math.max(46, Math.min(80, Math.floor(basis/2.2)));
        const inner = Math.max(outer - 36, 28);
        setRadius({ inner, outer });
        return;
      }
      // Expanded or normal mode
      const baseLimit = expanded ? 220 : 120; // aesthetic cap
      const constraint = Math.min(width, height || width);
      let outer = Math.min(baseLimit, Math.floor(constraint/2) - (expanded? 10:8));
      outer = Math.max(expanded ? 110 : 60, outer);
      if (outer*2 > constraint) outer = Math.floor(constraint/2) - 10;
      const ring = expanded ? 72 : 48; // ring thickness baseline
      let inner = outer - ring;
      const minInner = expanded ? 60 : 32;
      if (inner < minInner) inner = Math.max(minInner, Math.floor(outer*0.55));
      setRadius({ inner, outer });
    }
    recalc();
    const obs = new ResizeObserver(()=> recalc());
    if (targetRef.current) obs.observe(targetRef.current);
    return ()=> obs.disconnect();
  }, [mounted, data, compact, expanded]);

  const pieData = useMemo(()=> data.slice(0,6).map(d => ({ name: d.name, value: d.revenue, units: d.units, pct: d.revenue/total })), [data, total]);

  // Accesibilidad: cerrar con ESC si expanded
  useEffect(()=> {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setExpanded(false); }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Sin datos: el return anticipado va después de todos los hooks (reglas de hooks de React).
  if (!data.length) return <div className="p-4 text-xs border rounded-lg shadow-sm bg-white/90 text-neutral-500">Sin datos de categorías.</div>;

  return (
    <div className={`relative p-4 border rounded-lg bg-white/90 shadow-sm space-y-3 min-w-0 overflow-visible ${compact? 'flex flex-col':''}`}>      
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold text-neutral-600">Distribución por categoría</h3>
        <span className="text-[10px] text-neutral-400">{compact? (expanded? 'Detalle' : 'Donut') : 'Top 6 por ingresos'}</span>
      </div>
      <div
        ref={wrapperRef}
        className={compact ? 'mx-auto h-48 sm:h-52 max-w-[12rem] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60' : 'w-full h-[300px] sm:h-64 px-1'}
        tabIndex={compact? 0: -1}
        onClick={()=> compact && setExpanded(true)}
        aria-label={compact? 'Expandir distribución de categorías' : undefined}
        role={compact? 'button': undefined}
      >
        {!mounted ? <div className="h-full w-full animate-pulse flex items-center justify-center text-[11px] text-neutral-400 bg-neutral-50 rounded">Cargando…</div> : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={radius.inner} outerRadius={radius.outer} stroke="#fff" strokeWidth={1} paddingAngle={2}>
                {pieData.map((_,i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v:any,_name:any,p:any)=> [formatCurrency(Number(v)), `${p.payload.name} ${(p.payload.pct*100).toFixed(1)}%`]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      {!compact && !expanded && (
        <ul className="space-y-1 text-[11px] grid grid-cols-2 gap-x-4">
          {pieData.map((d,i)=>(
            <li key={d.name} className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 truncate" title={d.name}>{d.name}</span>
              <span className="tabular-nums font-medium shrink-0">{(d.pct*100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}

      {compact && expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
          role="dialog" aria-modal="true"
          onMouseDown={(e)=> { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="relative w-full max-w-xl p-5 space-y-4 bg-white border rounded-lg shadow-xl" role="document">
            <button
              onClick={()=> setExpanded(false)}
              className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-neutral-100 border hover:bg-neutral-200"
              aria-label="Cerrar vista expandida"
            >Cerrar</button>
            <h4 className="text-sm font-semibold text-neutral-700">Distribución por categoría</h4>
            <div ref={expandedWrapperRef} className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={radius.inner} outerRadius={radius.outer} stroke="#fff" strokeWidth={1} paddingAngle={2}>
                    {pieData.map((_,i)=> <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v:any,_name:any,p:any)=> [formatCurrency(Number(v)), `${p.payload.name} ${(p.payload.pct*100).toFixed(1)}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {pieData.map((d,i)=>(
                <li key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate" title={d.name}>{d.name}</span>
                  <span className="font-medium tabular-nums">{(d.pct*100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-neutral-400">Pulsa ESC, clic fuera o Cerrar para volver.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(n: number) { return new Intl.NumberFormat('es-GT',{ style:'currency', currency:'GTQ'}).format(n); }
