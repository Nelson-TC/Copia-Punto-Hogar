"use client";
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mapApiError } from '../src/lib/client-errors';
import { usePermissions } from '../src/lib/use-permissions';
import { marginPct, priceFromMargin, profitPerUnit } from '../src/lib/pricing';

interface ProductFormValues {
	id?: string;
	name: string;
	slug: string;
	description: string;
	price: string; // keep as string for input
	costPrice: string; // costo (ya incluye IVA)
	margin: string; // % sobre el precio de venta
	stock: string; // entero >= 0 (string para el input)
	categoryId: string;
	imageUrl: string; // only for showing existing stored image, no manual input
	active: boolean;
}

interface AdminProductFormProps {
	initial?: Partial<ProductFormValues> | null;
	categories: { id: string; name: string }[];
	mode?: 'create' | 'edit';
}

export default function AdminProductForm({ initial, categories, mode='create'}: AdminProductFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [values, setValues] = useState<ProductFormValues>({
		id: initial?.id,
		name: initial?.name || '',
		slug: initial?.slug || '',
		description: initial?.description || '',
		price: initial?.price ? String(initial.price) : '',
		costPrice: initial?.costPrice ? String(initial.costPrice) : '',
		margin: initial?.price && initial?.costPrice ? String(marginPct(Number(initial.price), Number(initial.costPrice)) ?? '') : '',
		stock: initial?.stock !== undefined && initial?.stock !== null ? String(initial.stock) : '0',
		categoryId: initial?.categoryId || categories[0]?.id || '',
		imageUrl: initial?.imageUrl || '',
		active: initial?.active ?? true
	});
	const [errors, setErrors] = useState<Record<string,string>>({});
	const [serverError, setServerError] = useState<string|null>(null);
	const [serverSuccess, setServerSuccess] = useState<string|null>(null);
	const [file, setFile] = useState<File|null>(null);
	const [filePreview, setFilePreview] = useState<string| null>(null);
	const [removeImage, setRemoveImage] = useState(false);
	// Que campo manda al recalcular: el margen (calcula el precio) o el precio (calcula el margen).
	const [driver, setDriver] = useState<'margin'|'price'>('price');
  const { can } = usePermissions();

	useEffect(()=>{ if (!values.slug && values.name) autoSlug(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

	function validate(v: ProductFormValues) {
		const e: Record<string,string> = {};
		if (!v.name.trim()) e.name = 'Nombre requerido';
		if (!v.slug.trim()) e.slug = 'Slug requerido';
		if (v.slug && !/^[a-z0-9-]+$/.test(v.slug)) e.slug = 'Formato inválido';
		if (!v.price.trim()) e.price = 'Precio requerido';
		if (v.price && isNaN(Number(v.price))) e.price = 'Debe ser numérico';
		else if (v.price && Number(v.price) <= 0) e.price = 'El precio debe ser mayor a 0';
		if (v.margin.trim() && (isNaN(Number(v.margin)) || Number(v.margin) >= 100)) e.margin = 'El margen debe ser menor a 100%';
		if (!/^[0-9]+$/.test(v.stock.trim())) e.stock = 'El stock debe ser un entero mayor o igual a 0';
		if (v.costPrice.trim() && (isNaN(Number(v.costPrice)) || Number(v.costPrice) < 0)) e.costPrice = 'El costo debe ser un número mayor o igual a 0';
		if (!v.categoryId) e.categoryId = 'Categoría requerida';
		return e;
	}

	function update<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
		setValues(s=>({ ...s, [key]: val }));
		if (errors[key as string]) setErrors(e=>{ const c={...e}; delete c[key as string]; return c; });
	}

	function num(s: string) { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) ? n : null; }

	// Costo, margen y precio estan ligados: al cambiar uno se recalcula el otro segun el campo que manda.
	function onCostChange(v: string) {
		const cost = num(v); const margin = num(values.margin); const price = num(values.price);
		setValues(s => {
			const next = { ...s, costPrice: v };
			const computed = cost !== null && margin !== null ? priceFromMargin(cost, margin) : null;
			if (driver === 'margin' && computed !== null) next.price = String(computed);
			else if (cost !== null && cost > 0 && price !== null && price > 0) next.margin = String(marginPct(price, cost) ?? '');
			return next;
		});
		setErrors(e => { const c = { ...e }; delete c.costPrice; return c; });
	}
	function onMarginChange(v: string) {
		setDriver('margin');
		const cost = num(values.costPrice); const margin = num(v);
		const computed = cost !== null && margin !== null ? priceFromMargin(cost, margin) : null;
	setValues(s => ({ ...s, margin: v, price: computed !== null ? String(computed) : s.price }));
	setErrors(e => { const c = { ...e }; delete c.margin; return c; });
	}
	function onPriceChange(v: string) {
		setDriver('price');
		const cost = num(values.costPrice); const price = num(v);
		setValues(s => ({ ...s, price: v, margin: cost !== null && cost > 0 && price !== null && price > 0 ? String(marginPct(price, cost) ?? '') : s.margin }));
		setErrors(e => { const c = { ...e }; delete c.price; return c; });
	}

	function autoSlug() {
		if (values.slug) return;
		update('slug', values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
	}


	function resetImageStates() {
		setFile(null);
		if (filePreview) { URL.revokeObjectURL(filePreview); }
		setFilePreview(null);
	}

	function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (!f) { resetImageStates(); return; }
		setFile(f);
		if (filePreview) URL.revokeObjectURL(filePreview);
		setFilePreview(URL.createObjectURL(f));
		// If user picks a file, clear manual URL field
		if (values.imageUrl) update('imageUrl', '');
		setRemoveImage(false);
	}

	async function onSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		setServerError(null); setServerSuccess(null);
		const e = validate(values); setErrors(e); if (Object.keys(e).length) return;

		// Decide: multipart (file chosen OR editing & removeImage) else JSON
		const needsMultipart = !!file || removeImage;
		startTransition(async ()=>{
			try {
				let res: Response;
				if (needsMultipart) {
					const form = new FormData();
					form.append('name', values.name.trim());
					form.append('slug', values.slug.trim());
					form.append('description', values.description.trim() || '');
					form.append('price', String(Number(values.price)));
					form.append('costPrice', String(Number(values.costPrice || 0)));
					form.append('stock', String(Number(values.stock)));
					form.append('categoryId', values.categoryId);
					form.append('active', String(values.active));
					if (file) form.append('image', file);
					if (removeImage) form.append('removeImage', 'true');
					const url = values.id? `/api/admin/products/${values.id}`:'/api/admin/products';
					res = await fetch(url, { method: values.id? 'PUT':'POST', body: form });
				} else {
					const payload = {
						name: values.name.trim(),
						slug: values.slug.trim(),
						description: values.description.trim() || null,
						price: Number(values.price),
						costPrice: Number(values.costPrice || 0),
						stock: Number(values.stock),
						categoryId: values.categoryId,
						imageUrl: null, // backend will fallback
						active: values.active
					};
					res = await fetch(values.id? `/api/admin/products/${values.id}`:'/api/admin/products', {
						method: values.id? 'PUT':'POST',
						headers: { 'Content-Type':'application/json' },
						body: JSON.stringify(payload)
					});
				}
				if (!res.ok) {
					const data = await res.json().catch(()=>null);
					throw new Error(mapApiError(data));
				}
				setServerSuccess(values.id? 'Producto actualizado':'Producto creado');
				setTimeout(()=>{ router.push('/admin/products'); router.refresh(); }, 700);
			} catch(err:any) { setServerError(err.message || 'Error'); }
		});
	}

	const cannotEdit = values.id ? !can('product:update') : !can('product:create');
	return (
		<form onSubmit={onSubmit} className="space-y-7" noValidate>
			<div className="space-y-1">
				<h1 className="text-xl font-semibold tracking-tight">{mode==='edit'? 'Editar producto':'Nuevo producto'}</h1>
				<p className="text-sm text-neutral-500">Gestiona la información visible en el catálogo.</p>
			</div>
			{serverError && <div className="px-3 py-2 text-sm rounded-md bg-red-100 text-red-700">{serverError}</div>}
			{serverSuccess && <div className="px-3 py-2 text-sm rounded-md bg-green-100 text-green-700">{serverSuccess}</div>}
			<div className="grid gap-8 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<div className="grid gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<label htmlFor="name" className="text-sm font-medium text-neutral-700">Nombre <span className="text-red-500">*</span></label>
							<input id="name" value={values.name} onChange={e=>update('name', e.target.value)} onBlur={autoSlug} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.name? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="Organizador de cocina" />
							{errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
						</div>
						<div className="space-y-2">
							<label htmlFor="slug" className="text-sm font-medium text-neutral-700">Slug <span className="text-red-500">*</span></label>
							<input id="slug" value={values.slug} onChange={e=>update('slug', e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border font-mono focus:outline-none focus:ring-2 ${errors.slug? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="organizador-de-cocina" />
							{errors.slug && <p className="text-xs text-red-500">{errors.slug}</p>}
						</div>
						<div className="space-y-2">
							<label htmlFor="stock" className="text-sm font-medium text-neutral-700">Stock (existencias) <span className="text-red-500">*</span></label>
							<input id="stock" inputMode="numeric" value={values.stock} onChange={e=>update('stock', e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.stock? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="25" />
							{errors.stock && <p className="text-xs text-red-500">{errors.stock}</p>}
							<p className="text-[11px] text-neutral-500">Con stock 0 el producto aparece como agotado y no puede agregarse al carrito.</p>
						</div>
						<div className="space-y-2">
							<label htmlFor="category" className="text-sm font-medium text-neutral-700">Categoría <span className="text-red-500">*</span></label>
							<select id="category" value={values.categoryId} onChange={e=>update('categoryId', e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.categoryId? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`}>
								{categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
							{errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId}</p>}
						</div>
					</div>
					<fieldset className="p-4 space-y-4 border rounded-lg border-neutral-200 bg-neutral-50/60">
						<legend className="px-2 text-sm font-semibold text-nav">Costo, margen y precio de venta</legend>
						<div className="grid gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<label htmlFor="costPrice" className="text-sm font-medium text-neutral-700">Costo (Q, con IVA)</label>
								<input id="costPrice" inputMode="decimal" value={values.costPrice} onChange={e=>onCostChange(e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.costPrice? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="60.00" />
								{errors.costPrice && <p className="text-xs text-red-500">{errors.costPrice}</p>}
							</div>
							<div className="space-y-2">
								<label htmlFor="margin" className="text-sm font-medium text-neutral-700">Margen de ganancia (%)</label>
								<div className="relative">
									<input id="margin" inputMode="decimal" value={values.margin} onChange={e=>onMarginChange(e.target.value)} className="w-full px-3 py-2 pr-8 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50" placeholder="40" />
									<span className="absolute text-sm -translate-y-1/2 pointer-events-none right-3 top-1/2 text-neutral-400">%</span>
								</div>
								{errors.margin && <p className="text-xs text-red-500">{errors.margin}</p>}
			<p className="text-[11px] text-neutral-500">Precio = costo ÷ (1 − margen).</p>
							</div>
							<div className="space-y-2">
								<label htmlFor="price" className="text-sm font-medium text-neutral-700">Precio de venta (Q, con IVA) <span className="text-red-500">*</span></label>
								<input id="price" inputMode="decimal" value={values.price} onChange={e=>onPriceChange(e.target.value)} className={`w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 ${errors.price? 'border-red-400 ring-red-200':'border-neutral-300 focus:ring-carrot/50'}`} placeholder="89.90" />
								{errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
								<p className="text-[11px] text-neutral-500">O escribe el precio y el margen se calcula.</p>
							</div>
						</div>
						<PriceBreakdown price={num(values.price)} cost={num(values.costPrice)} />
					</fieldset>
					<div className="space-y-2">
						<label htmlFor="description" className="text-sm font-medium text-neutral-700">Descripción</label>
						<textarea id="description" value={values.description} onChange={e=>update('description', e.target.value)} rows={5} className="w-full px-3 py-2 text-sm leading-relaxed rounded-md border bg-white border-neutral-300 focus:outline-none focus:ring-2 focus:ring-carrot/50" placeholder="Detalles, beneficios, recomendaciones..."/>
						<p className="text-[11px] text-neutral-500">Markdown ligero (p.ej. *texto*) podría agregarse en una futura mejora.</p>
					</div>
				</div>
				<div className="space-y-8">
					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-neutral-700">Imagen del producto</label>
							<input id="image" type="file" accept="image/*" onChange={onFileChange} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-carrot file:text-nav hover:file:bg-carrot-dark" />
							<p className="text-[11px] text-neutral-500">Sube una imagen (se almacenará en /items). Si no subes nada se usará la imagen por defecto.</p>
							{(filePreview || values.imageUrl) && !removeImage && (
								<div className="relative mt-3 overflow-hidden border rounded-lg aspect-square w-full max-w-[260px] border-neutral-300 bg-neutral-50 group dark:bg-neutral-900/20">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={filePreview || values.imageUrl} alt="Previsualización" className="object-cover w-full h-full transition group-hover:scale-[1.02]" />
									<button type="button" onClick={()=>{ resetImageStates(); update('imageUrl',''); if (mode==='edit') setRemoveImage(true); }} className="absolute z-10 px-2 py-1 text-xs font-medium transition rounded-md opacity-90 top-2 right-2 bg-neutral-900/70 text-white hover:bg-neutral-900">Quitar</button>
								</div>
							)}
							{mode==='edit' && !filePreview && !values.imageUrl && (
								<label className="flex items-center gap-2 text-xs text-neutral-600">
									<input type="checkbox" checked={removeImage} onChange={e=>setRemoveImage(e.target.checked)} className="w-4 h-4 rounded border-neutral-300 text-carrot focus:ring-carrot/50" />
									Eliminar imagen (usar fallback)
								</label>
							)}
							{removeImage && (
								<p className="text-[11px] text-red-600">Se eliminará la imagen y se aplicará el fallback.</p>
							)}
						</div>
					</div>
					<fieldset className="space-y-3">
						<legend className="text-sm font-medium text-neutral-700">Estado</legend>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={values.active} onChange={e=>update('active', e.target.checked)} className="w-4 h-4 rounded border-neutral-300 text-carrot focus:ring-carrot/50" />
							Activo (visible en catálogo)
						</label>
					</fieldset>
				</div>
			</div>
			<div className="flex flex-wrap gap-3 pt-2">
				<button disabled={isPending || cannotEdit} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md bg-carrot text-nav hover:bg-carrot-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/60 disabled:opacity-60 disabled:cursor-not-allowed">
					{isPending && <i className='bx bx-loader-alt animate-spin text-base'/>}
					{values.id? 'Guardar cambios':'Crear producto'}
				</button>
				<button type="button" disabled={isPending} onClick={()=>router.push('/admin/products')} className="px-5 py-2.5 text-sm font-medium transition rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-carrot/50 disabled:opacity-50">Cancelar</button>
				{cannotEdit && <p className="w-full text-xs text-red-500">No tienes permiso para {values.id? 'actualizar':'crear'} productos.</p>}
			</div>
		</form>
	);
}

// Resumen en vivo: ganancia por unidad y margen (costo y precio ya incluyen IVA, no se separa).
function PriceBreakdown({ price, cost }: { price: number | null; cost: number | null }) {
	const money = (n: number) => `Q${n.toFixed(2)}`;
	if (price === null || price <= 0) return <p className="text-xs text-neutral-500">Captura el costo y el margen (o el precio de venta) para ver la ganancia.</p>;
	const hasCost = cost !== null && cost > 0;
	const profit = hasCost ? profitPerUnit(price, cost as number) : null;
	const margin = hasCost ? marginPct(price, cost as number) : null;
	const loss = profit !== null && profit < 0;
	return (
		<div className="space-y-2" data-testid="price-breakdown">
			<dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
				<div className="flex justify-between gap-2"><dt className="text-neutral-500">Ganancia por unidad</dt><dd className={`font-semibold tabular-nums ${loss ? 'text-red-600' : 'text-green-700'}`}>{profit !== null ? money(profit) : '—'}</dd></div>
				<div className="flex justify-between gap-2"><dt className="text-neutral-500">Margen de ganancia</dt><dd className="font-medium tabular-nums">{margin !== null ? `${margin}%` : '—'}</dd></div>
				<div className="flex justify-between gap-2"><dt className="text-neutral-500">Precio de venta</dt><dd className="font-medium tabular-nums">{money(price)}</dd></div>
			</dl>
			{loss && <p role="alert" className="text-xs font-medium text-red-600">Con este precio la tienda pierde dinero: el precio no cubre el costo.</p>}
			{!hasCost && <p className="text-xs text-amber-700">Sin costo registrado no se puede calcular la ganancia.</p>}
		</div>
	);
}
