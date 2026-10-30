import { getCurrentUser } from '@/lib/auth-server';
import { getUserPermissions } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Row { id: string; createdAt: string; userEmail: string|null; action: string; entity: string|null; entityId: string|null; metadata: any }

function formatMeta(meta: any) {
  if (!meta) return '-';
  try {
    return JSON.stringify(meta);
  } catch {
    return '-';
  }
}

export default async function AuditLogPage({ searchParams }: { searchParams: Record<string,string|undefined> }) {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-red-600">No autenticado.</p>;
  const perms = await getUserPermissions(user.id);
  const canRead = perms.has('admin:access') || perms.has('audit:read');
  if (!canRead) return <p className="text-sm text-red-600">No autorizado.</p>;

  const take = 50;
  const cursor = searchParams.cursor;
  const q = (searchParams.q || '').trim();
  const where = {} as any;
  if (q) {
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { entity: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q } },
      { user: { is: { email: { contains: q, mode: 'insensitive' } } } }
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) ,
    include: { user: { select: { email: true } } }
  });
  const hasMore = logs.length > take;
  const pageLogs = hasMore ? logs.slice(0, take) : logs;
  const nextCursor = hasMore ? pageLogs[pageLogs.length - 1].id : null;

  const rows: Row[] = pageLogs.map(l => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    userEmail: l.user?.email || null,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    metadata: l.metadata
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Auditoría</h1>
          <p className="text-sm text-neutral-600">
            Últimas acciones registradas{q ? <> — búsqueda: <span className="font-medium">&quot;{q}&quot;</span></> : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/admin/audit" method="get" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar… (acción, entidad, ID, email)"
              className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white"
              autoComplete='off'
            />
            <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 bg-white hover:bg-neutral-50">Buscar</button>
            {q && (
              <Link href="/admin/audit" className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 bg-white hover:bg-neutral-50">Limpiar</Link>
            )}
          </form>
          <Link href="/admin" className="px-4 py-2 text-sm font-medium transition bg-white border rounded-md border-neutral-300 hover:bg-neutral-50">Panel</Link>
        </div>
      </header>

      {rows.length === 0 && <p className="text-sm text-neutral-600">No hay registros.</p>}

      {rows.length > 0 && (
        <div className="overflow-auto border rounded-lg bg-white/90">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="text-[11px] uppercase tracking-wide bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2 text-left">Entidad</th>
                <th className="px-3 py-2 text-left">ID Entidad</th>
                <th className="px-3 py-2 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">{r.createdAt.replace('T',' ').slice(0,19)}</td>
                  <td className="px-3 py-2 text-xs">{r.userEmail || '-'}</td>
                  <td className="px-3 py-2 text-xs font-medium">{r.action}</td>
                  <td className="px-3 py-2 text-xs">{r.entity || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.entityId || '-'}</td>
                  <td className="px-3 py-2 text-xs max-w-[340px] truncate" title={formatMeta(r.metadata)}>{formatMeta(r.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="text-[11px] text-neutral-500">Mostrando {rows.length} registro(s){hasMore && ' (parcial)'}</div>
        <div className="flex gap-2">
          {nextCursor && (
            <Link href={`/admin/audit?cursor=${nextCursor}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="px-3 py-1 text-xs font-medium bg-white border rounded-md border-neutral-300 hover:bg-neutral-50">Más</Link>
          )}
        </div>
      </div>
    </div>
  );
}
