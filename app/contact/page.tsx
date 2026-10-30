import ContactForm from '../../components/ContactForm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ContactPage() {
	return (
		<div className="space-y-12">
			<Hero />
			<div className="grid gap-10 lg:grid-cols-3">
				<div className="space-y-8 lg:col-span-2">
					<InfoBlocks />
					<ContactForm />
				</div>
				<aside className="space-y-6 lg:sticky lg:top-24 h-max">
					<SupportCard />
					<FAQCard />
				</aside>
			</div>
		</div>
	);
}

function Hero() {
	return (
		<section className="space-y-4">
			<h1 className="text-3xl font-bold tracking-tight">Contacto</h1>
			<p className="max-w-2xl text-sm leading-relaxed text-neutral-600">¿Tienes dudas sobre un producto, tu pedido o necesitas recomendaciones para tu hogar? Escríbenos y nuestro equipo te responderá lo antes posible.</p>
		</section>
	);
}

function InfoBlocks() {
	const items = [
		{ label: 'Soporte general', value: 'soporte@puntohogar.store', type: 'email' },
		{ label: 'Teléfono', value: '+502 5555 1234', type: 'tel' },
		{ label: 'Horario', value: 'Lun - Vie · 9:00 a 18:00 GT', type: 'text' }
	];
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			{items.map(i => (
				<div key={i.label} className="p-4 border rounded-lg shadow-sm bg-surface">
					<p className="text-[11px] uppercase tracking-wide text-neutral-500 font-medium">{i.label}</p>
					<p className="mt-1 text-sm font-semibold break-words text-nav">{i.value}</p>
				</div>
			))}
		</div>
	);
}

function SupportCard() {
	return (
		<div className="p-5 space-y-3 text-sm border rounded-lg shadow-sm bg-surface text-neutral-600">
			<p className="font-semibold text-neutral-800">¿Cómo ayudamos?</p>
			<ul className="space-y-2 text-[13px] list-disc pl-5">
				<li>Asesoría para elegir alimento y juguetes.</li>
				<li>Estado de pedidos y ajustes de dirección.</li>
				<li>Reportar problemas con productos.</li>
			</ul>
			<p className="text-[11px] text-neutral-500">Tiempo de respuesta medio: 24h laborables.</p>
		</div>
	);
}

function FAQCard() {
	const faqs = [
		{ q: '¿Puedo modificar un pedido?', a: 'Sí, si aún no ha sido enviado. Escríbenos cuanto antes indicando el cambio.' },
		{ q: '¿Hacen envíos fuera de Guatemala?', a: 'Actualmente solo operamos dentro del territorio nacional.' },
		{ q: '¿Productos sin stock?', a: 'Puedes consultarnos y te notificamos cuando regresen.' }
	];
	return (
		<div className="p-5 space-y-4 border rounded-lg shadow-sm bg-surface">
			<h2 className="text-base font-semibold text-nav">Preguntas rápidas</h2>
			<ul className="space-y-4 text-[13px] text-neutral-700">
				{faqs.map(f => (
					<li key={f.q} className="space-y-1">
						<p className="font-medium text-neutral-800">{f.q}</p>
						<p className="leading-relaxed text-neutral-600">{f.a}</p>
					</li>
				))}
			</ul>
		</div>
	);
}
