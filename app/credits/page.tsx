import credits from '../../src/data/image-credits.json';

export const metadata = { title: 'Créditos de imágenes | Punto Hogar' };

interface Credit { product: string; title: string | null; creator: string | null; license: string; licenseVersion: string | null; source: string | null; url: string | null }

const LICENSE_URL = (c: Credit) => {
  const l = c.license.toLowerCase();
  if (l === 'cc0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (l === 'pdm') return 'https://creativecommons.org/publicdomain/mark/1.0/';
  return `https://creativecommons.org/licenses/${l}/${c.licenseVersion || '4.0'}/`;
};
const LICENSE_LABEL = (c: Credit) => c.license.toLowerCase() === 'cc0' ? 'CC0' : c.license.toLowerCase() === 'pdm' ? 'Dominio público' : `CC ${c.license.toUpperCase()}${c.licenseVersion ? ' ' + c.licenseVersion : ''}`;

// Las fotos de los productos provienen de bancos de imágenes con licencia libre (Openverse).
// Esta página da el crédito a cada autor, como piden las licencias Creative Commons.
export default function CreditsPage() {
  const items = credits as Credit[];
  return (
    <div className="max-w-4xl px-4 py-8 mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Créditos de imágenes</h1>
        <p className="text-sm text-neutral-600">Las fotografías de los productos son imágenes de ejemplo con licencia libre. Gracias a sus autores.</p>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Aún no hay créditos registrados.</p>
      ) : (
        <ul className="overflow-hidden bg-white border divide-y rounded-lg">
          {items.map((c, i) => (
            <li key={i} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-nav">{c.product}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">“{c.title || 'Foto'}”</a> : <>“{c.title || 'Foto'}”</>}
                  {c.creator ? <> por {c.creator}</> : null}{c.source ? <> · {c.source}</> : null}
                </p>
              </div>
              <a href={LICENSE_URL(c)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-carrot-dark hover:underline whitespace-nowrap">{LICENSE_LABEL(c)}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
