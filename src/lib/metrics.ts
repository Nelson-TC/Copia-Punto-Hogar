import { prisma } from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface DateRange { from: Date; to: Date; granularity: 'day' | 'week' | 'month'; }

function parseRange(from?: string, to?: string, granularity?: string): DateRange {
  const now = new Date();
  let toDate = to ? new Date(to) : now;
  let fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29*24*3600*1000);
  if (fromDate > toDate) fromDate = new Date(toDate.getTime() - 24*3600*1000);
  const g: any = (granularity === 'week' || granularity === 'month') ? granularity : 'day';
  return { from: new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())), to: new Date(Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())), granularity: g };
}

export function normalizeRange(params: { from?: string; to?: string; g?: string }): DateRange {
  let g = params.g;
  if (g) {
    const lower = g.toLowerCase();
    if (lower === 'd') g = 'day';
    else if (lower === 'w') g = 'week';
    else if (lower === 'm') g = 'month';
  }
  return parseRange(params.from, params.to, g);
}

// Given a current range, produce the immediately preceding range of identical length
export function previousRange(range: DateRange): DateRange {
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1);
  const prevTo = new Date(range.from.getTime() - 86400000); // day before current start
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { from: prevFrom, to: prevTo, granularity: range.granularity };
}

function toNum(n: any) { return n instanceof Decimal ? Number(n) : Number(n ?? 0); }

export interface SummaryMetrics {
  range: { from: string; to: string; granularity: string };
  totals: { revenue: number; orders: number; aov: number; units: number; profit: number; profitMarginPct: number };
  users: { newUsers: number; buyers: number; repeat: number };
  orders: { canceled: number; canceledPct: number };
  generatedAt: string;
}

export async function getSummaryMetrics(range: DateRange): Promise<SummaryMetrics> {
  const { from, to } = range;
  // Extend end boundary to include the whole 'to' day
  const toEnd = new Date(to.getTime() + 24*3600*1000);
  const [orders, usersInRange, allBuyers] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: from, lt: toEnd } }, include: { items: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: from, lt: toEnd } }, select: { id: true } }),
    prisma.order.groupBy({ by: ['userId'], _count: { userId: true }, where: { userId: { not: null }, createdAt: { gte: from, lt: toEnd } } }).catch(()=>[] as any)
  ]);

  let revenue = 0; let units = 0; let canceled = 0;
  // Ganancia: precio de venta menos costo de lo vendido. Solo pedidos no cancelados y solo líneas con costo registrado
  // (unitCost = 0 significa "costo desconocido"; incluirlas inflaría la ganancia).
  let profit = 0; let salesWithCost = 0;
  for (const o of orders) {
    revenue += toNum(o.total);
    if (o.status === 'CANCELED') canceled++;
    for (const it of o.items) {
      units += it.quantity;
      const cost = toNum(it.unitCost);
      if (o.status !== 'CANCELED' && cost > 0) {
        const price = toNum(it.unitPrice);
        profit += (price - cost) * it.quantity;
        salesWithCost += price * it.quantity;
      }
    }
  }
  const profitMarginPct = salesWithCost ? profit / salesWithCost : 0;
  const ordersCount = orders.length;
  const aov = ordersCount ? revenue / ordersCount : 0;
  const buyers = allBuyers.length;
  const repeat = (allBuyers as { userId: string|null; _count: { userId: number } }[]).filter(b => b._count.userId > 1).length;
  const canceledPct = ordersCount ? canceled / ordersCount : 0;

  return {
    range: { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), granularity: range.granularity },
    totals: { revenue, orders: ordersCount, aov, units, profit, profitMarginPct },
    users: { newUsers: usersInRange.length, buyers, repeat },
    orders: { canceled, canceledPct },
    generatedAt: new Date().toISOString()
  };
}

export interface TimeSeriesPoint { date: string; revenue: number; orders: number; units: number; }

export async function getTimeSeries(range: DateRange): Promise<TimeSeriesPoint[]> {
  const { from, to } = range;
  const toEnd = new Date(to.getTime() + 24*3600*1000);
  const orders = await prisma.order.findMany({ where: { createdAt: { gte: from, lt: toEnd } }, include: { items: true } });

  const bucketMap = new Map<string, { revenue: number; orders: number; units: number }>();
  function bucketKey(d: Date) {
    if (range.granularity === 'day') return d.toISOString().slice(0,10);
    if (range.granularity === 'week') {
      // ISO week approx: use Monday anchor
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = tmp.getUTCDay() || 7; // 1..7
      tmp.setUTCDate(tmp.getUTCDate() - (day - 1));
      return tmp.toISOString().slice(0,10);
    }
    // month
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;
  }

  for (const o of orders) {
    const key = bucketKey(o.createdAt);
    let bucket = bucketMap.get(key);
    if (!bucket) { bucket = { revenue: 0, orders: 0, units: 0 }; bucketMap.set(key, bucket); }
    bucket.revenue += toNum(o.total);
    bucket.orders += 1;
    for (const it of o.items) bucket.units += it.quantity;
  }

  // Fill gaps for day granularity
  const points: TimeSeriesPoint[] = [];
  if (range.granularity === 'day') {
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24*3600*1000)) {
      const key = d.toISOString().slice(0,10);
      const b = bucketMap.get(key) || { revenue: 0, orders: 0, units: 0 };
      points.push({ date: key, revenue: b.revenue, orders: b.orders, units: b.units });
    }
  } else {
    // For week/month just use existing keys sorted
    const sorted = Array.from(bucketMap.entries()).sort((a,b) => a[0] < b[0] ? -1 : 1);
    for (const [date, b] of sorted) points.push({ date, revenue: b.revenue, orders: b.orders, units: b.units });
  }
  return points;
}

// User growth (new users per bucket and cumulative buyers approximation not included here)
export interface UserSeriesPoint { date: string; newUsers: number; }
export async function getUserSeries(range: DateRange): Promise<UserSeriesPoint[]> {
  const { from, to } = range; const toEnd = new Date(to.getTime() + 24*3600*1000);
  const users = await prisma.user.findMany({ where: { createdAt: { gte: from, lt: toEnd } }, select: { createdAt: true } });
  const map = new Map<string, number>();
  function bucketKey(d: Date) {
    if (range.granularity === 'day') return d.toISOString().slice(0,10);
    if (range.granularity === 'week') {
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = tmp.getUTCDay() || 7; tmp.setUTCDate(tmp.getUTCDate() - (day - 1));
      return tmp.toISOString().slice(0,10);
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;
  }
  for (const u of users) {
    const key = bucketKey(u.createdAt);
    map.set(key, (map.get(key) || 0) + 1);
  }
  const points: UserSeriesPoint[] = [];
  if (range.granularity === 'day') {
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24*3600*1000)) {
      const key = d.toISOString().slice(0,10);
      points.push({ date: key, newUsers: map.get(key) || 0 });
    }
  } else {
    const sorted = Array.from(map.entries()).sort((a,b)=> a[0]<b[0]? -1:1);
    for (const [date, n] of sorted) points.push({ date, newUsers: n });
  }
  return points;
}

export interface TopProduct { productId: string; name: string; revenue: number; units: number; }

export async function getTopProducts(range: DateRange, limit = 10): Promise<TopProduct[]> {
  const { from, to } = range;
  const toEnd = new Date(to.getTime() + 24*3600*1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: from, lt: toEnd } } },
    select: { productId: true, name: true, unitPrice: true, quantity: true }
  });
  const map = new Map<string, { name: string; revenue: number; units: number }>();
  for (const it of items) {
    const entry = map.get(it.productId) || { name: it.name, revenue: 0, units: 0 };
    entry.revenue += toNum(it.unitPrice) * it.quantity;
    entry.units += it.quantity;
    map.set(it.productId, entry);
  }
  const arr = Array.from(map.entries()).map(([productId, v]) => ({ productId, name: v.name, revenue: v.revenue, units: v.units }));
  arr.sort((a,b) => b.revenue - a.revenue);
  return arr.slice(0, limit);
}

export interface CategoryDistributionItem { categoryId: string; name: string; revenue: number; units: number; }
export async function getCategoryDistribution(range: DateRange): Promise<CategoryDistributionItem[]> {
  const { from, to } = range; const toEnd = new Date(to.getTime() + 24*3600*1000);
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: from, lt: toEnd } } },
    select: { quantity: true, unitPrice: true, product: { select: { categoryId: true, category: { select: { id: true, name: true } } } } }
  });
  const map = new Map<string, { name: string; revenue: number; units: number }>();
  for (const it of items) {
    const cat = it.product.category;
    if (!cat) continue;
    const entry = map.get(cat.id) || { name: cat.name, revenue: 0, units: 0 };
    entry.revenue += toNum(it.unitPrice) * it.quantity;
    entry.units += it.quantity;
    map.set(cat.id, entry);
  }
  return Array.from(map.entries()).map(([categoryId, v]) => ({ categoryId, name: v.name, revenue: v.revenue, units: v.units }))
    .sort((a,b) => b.revenue - a.revenue);
}

export interface OrderStatusBreakdownPoint { date: string; PENDING: number; PAID: number; SHIPPED: number; COMPLETED: number; CANCELED: number; }
export async function getOrderStatusBreakdown(range: DateRange): Promise<OrderStatusBreakdownPoint[]> {
  const { from, to } = range; const toEnd = new Date(to.getTime() + 24*3600*1000);
  const orders = await prisma.order.findMany({ where: { createdAt: { gte: from, lt: toEnd } }, select: { status: true, createdAt: true } });
  const map = new Map<string, { PENDING: number; PAID: number; SHIPPED: number; COMPLETED: number; CANCELED: number }>();
  function bucket(d: Date) {
    if (range.granularity === 'day') return d.toISOString().slice(0,10);
    if (range.granularity === 'week') {
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = tmp.getUTCDay() || 7; tmp.setUTCDate(tmp.getUTCDate() - (day - 1));
      return tmp.toISOString().slice(0,10);
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;
  }
  for (const o of orders) {
    const key = bucket(o.createdAt);
    let rec = map.get(key);
    if (!rec) { rec = { PENDING:0, PAID:0, SHIPPED:0, COMPLETED:0, CANCELED:0 }; map.set(key, rec); }
    // @ts-ignore status union
    rec[o.status] += 1;
  }
  const points: OrderStatusBreakdownPoint[] = [];
  if (range.granularity === 'day') {
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24*3600*1000)) {
      const key = d.toISOString().slice(0,10);
      const rec = map.get(key) || { PENDING:0, PAID:0, SHIPPED:0, COMPLETED:0, CANCELED:0 };
      points.push({ date: key, ...rec });
    }
  } else {
    const sorted = Array.from(map.entries()).sort((a,b)=> a[0]<b[0]? -1:1);
    for (const [date, rec] of sorted) points.push({ date, ...rec });
  }
  return points;
}

// CSV helpers
export function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h=> esc(r[h])).join(','))].join('\n');
}

export function exportSummaryCsv(summary: SummaryMetrics): string {
  return toCsv([
    { metric: 'revenue', value: summary.totals.revenue },
    { metric: 'orders', value: summary.totals.orders },
    { metric: 'aov', value: summary.totals.aov },
    { metric: 'units', value: summary.totals.units },
    { metric: 'profit', value: summary.totals.profit },
    { metric: 'profitMarginPct', value: summary.totals.profitMarginPct },
    { metric: 'newUsers', value: summary.users.newUsers },
    { metric: 'buyers', value: summary.users.buyers },
    { metric: 'repeat', value: summary.users.repeat },
    { metric: 'canceled', value: summary.orders.canceled },
    { metric: 'canceledPct', value: summary.orders.canceledPct }
  ]);
}

// Additional corporate-style dashboard helpers
export interface RecentOrder { id: string; status: string; total: number; createdAt: string; userEmail: string | null; items: number; }
export async function getRecentOrders(range: DateRange, limit = 8): Promise<RecentOrder[]> {
  const { from, to } = range; const toEnd = new Date(to.getTime() + 86400000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lt: toEnd } },
    include: { user: { select: { email: true } }, items: { select: { quantity: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  return orders.map(o => ({
    id: o.id,
    status: o.status,
    total: toNum(o.total),
    createdAt: o.createdAt.toISOString(),
    userEmail: (o as any).user?.email || null,
    items: o.items.reduce((a,b)=> a + b.quantity, 0)
  }));
}

export interface OrderStatusTotals { PENDING: number; PAID: number; SHIPPED: number; COMPLETED: number; CANCELED: number; total: number; }
export async function getOrderStatusTotals(range: DateRange): Promise<OrderStatusTotals> {
  const breakdown = await getOrderStatusBreakdown(range);
  const totals: OrderStatusTotals = { PENDING:0, PAID:0, SHIPPED:0, COMPLETED:0, CANCELED:0, total:0 };
  for (const row of breakdown) {
    totals.PENDING += row.PENDING; totals.PAID += row.PAID; totals.SHIPPED += row.SHIPPED;
    totals.COMPLETED += row.COMPLETED; totals.CANCELED += row.CANCELED;
  }
  totals.total = totals.PENDING + totals.PAID + totals.SHIPPED + totals.COMPLETED + totals.CANCELED;
  return totals;
}
