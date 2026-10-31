// Seed de "Punto Hogar": categorías, usuarios de prueba, catálogo con existencias y pedidos de ejemplo.
// Es idempotente para categorías, usuarios y productos (upsert); los pedidos solo se generan si no existen.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function upsertUser({ email, name, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role }
  });
}

function slugify(base) {
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Catálogo base: [nombre, descripción, precio en Q (IVA incluido), stock]
// Se incluyen a propósito productos agotados (stock 0) y con stock bajo para poder probar esos escenarios.
const CATALOG = [
  {
    name: 'Hogar y decoración',
    products: [
      ['Cojín decorativo gris 45x45', 'Cojín de tela suave con relleno hipoalergénico, ideal para sala o dormitorio.', 59.9, 40],
      ['Marco para fotos madera 20x25', 'Marco de madera natural con vidrio frontal, para pared o mesa.', 74.5, 25],
      ['Jarrón de cerámica blanco', 'Jarrón de cerámica esmaltada de 25 cm, acabado mate.', 129, 12],
      ['Reloj de pared minimalista', 'Reloj silencioso de 30 cm con marco negro.', 149.9, 18],
      ['Alfombra tejida 120x170', 'Alfombra de fibra resistente, fácil de limpiar.', 389, 8],
      ['Espejo redondo con marco dorado', 'Espejo decorativo de 60 cm con marco metálico.', 345, 5],
      ['Cortina blackout 140x220', 'Cortina térmica que bloquea la luz, incluye argollas.', 215, 22],
      ['Set de 3 velas aromáticas', 'Velas de soya con aroma a vainilla, duración aproximada de 30 horas.', 95, 0]
    ]
  },
  {
    name: 'Cocina',
    products: [
      ['Juego de ollas antiadherentes 5 piezas', 'Ollas con tapa de vidrio, aptas para estufa de gas y eléctrica.', 549, 14],
      ['Sartén antiadherente 28 cm', 'Sartén de aluminio con mango ergonómico resistente al calor.', 169.9, 30],
      ['Set de cuchillos de cocina 6 piezas', 'Acero inoxidable con base de madera para guardarlos.', 285, 16],
      ['Tabla para picar de bambú', 'Tabla grande de bambú con canal para jugos.', 89, 35],
      ['Licuadora de vaso de vidrio 1.5 L', 'Motor de 600 W, tres velocidades y función pulso.', 425, 9],
      ['Organizador de especias giratorio', 'Base giratoria con 12 frascos de vidrio con tapa.', 199, 4],
      ['Termo de acero inoxidable 1 L', 'Mantiene la temperatura hasta 12 horas.', 135, 27],
      ['Juego de vasos de vidrio 6 piezas', 'Vasos de 350 ml aptos para lavavajillas.', 79.9, 50]
    ]
  },
  {
    name: 'Dormitorio',
    products: [
      ['Juego de sábanas queen 4 piezas', 'Microfibra suave, incluye sábana ajustable, plana y dos fundas.', 245, 20],
      ['Almohada viscoelástica', 'Almohada ergonómica con funda lavable.', 175, 28],
      ['Edredón reversible matrimonial', 'Relleno de fibra hueca, ligero y cálido.', 395, 10],
      ['Protector de colchón impermeable', 'Protector transpirable con ajuste elástico a las esquinas.', 160, 17],
      ['Lámpara de mesa de noche', 'Lámpara con base de madera y pantalla de tela.', 189, 13],
      ['Cobija polar 150x200', 'Cobija suave de microfibra en varios colores.', 129, 33],
      ['Organizador de closet colgante', 'Organizador de tela con 6 compartimentos.', 98, 21],
      ['Perchero de pie metálico', 'Perchero de 8 ganchos con base estable.', 215, 0]
    ]
  },
  {
    name: 'Baño',
    products: [
      ['Juego de toallas 4 piezas', 'Toallas de algodón de alta absorción en dos tamaños.', 189, 26],
      ['Cortina de baño impermeable', 'Cortina antimoho de 180x180 con 12 argollas.', 85, 31],
      ['Organizador de ducha esquinero', 'Estante de aluminio sin taladro con ventosas.', 119, 15],
      ['Dispensador de jabón de pared', 'Dispensador de 400 ml, acabado cromo.', 99.9, 19],
      ['Alfombra antideslizante para baño', 'Alfombra de microfibra de secado rápido.', 69, 38],
      ['Cesto de ropa plegable', 'Cesto de tela con asas y estructura plegable.', 105, 3],
      ['Espejo de baño con luz LED', 'Espejo de 50x70 con luz integrada y botón táctil.', 465, 7],
      ['Set de accesorios de baño 4 piezas', 'Vaso, jabonera, dispensador y portacepillos en cerámica.', 145, 22]
    ]
  },
  {
    name: 'Limpieza',
    products: [
      ['Trapeador giratorio con cubeta', 'Sistema de escurrido giratorio con dos repuestos de microfibra.', 255, 18],
      ['Escoba y recogedor', 'Set de escoba de cerdas firmes con recogedor y peine.', 79, 45],
      ['Aspiradora de mano recargable', 'Aspiradora portátil sin cable con filtro lavable.', 349, 6],
      ['Paños de microfibra (paquete de 10)', 'Paños multiusos que no dejan pelusa.', 55, 60],
      ['Cubeta con escurridor 12 L', 'Cubeta de plástico resistente con escurridor integrado.', 48, 36],
      ['Guantes de hule para limpieza', 'Guantes reforzados talla mediana.', 22.5, 70],
      ['Bolsas para basura 100 unidades', 'Bolsas negras reforzadas de 30 galones.', 65, 55],
      ['Cepillo para sanitario con base', 'Cepillo con base cerrada y mango largo.', 35, 2]
    ]
  },
  {
    name: 'Ferretería y herramientas',
    products: [
      ['Martillo de acero 16 oz', 'Martillo de uña con mango antideslizante.', 79.9, 24],
      ['Juego de destornilladores 12 piezas', 'Puntas planas y de estrella con estuche.', 115, 29],
      ['Taladro inalámbrico 12 V', 'Incluye batería, cargador y 20 accesorios.', 625, 8],
      ['Cinta métrica 5 m', 'Cinta con carcasa reforzada y traba de seguridad.', 39.9, 48],
      ['Caja de herramientas plástica 19"', 'Caja con bandeja interior y cierres metálicos.', 189, 14],
      ['Llave ajustable 10"', 'Llave de acero cromado con apertura de 30 mm.', 85, 20],
      ['Nivel de burbuja 60 cm', 'Nivel de aluminio con tres burbujas.', 75, 11],
      ['Candado de seguridad 50 mm', 'Candado de acero con tres llaves.', 59, 5]
    ]
  },
  {
    name: 'Iluminación',
    products: [
      ['Foco LED 9 W luz cálida (paquete de 4)', 'Ahorro de energía, base E27, vida útil de 15,000 horas.', 69.9, 80],
      ['Lámpara de escritorio flexible', 'Lámpara LED con brazo ajustable y tres niveles de brillo.', 175, 17],
      ['Tira LED RGB 5 metros', 'Tira adhesiva con control remoto y fuente de poder.', 135, 23],
      ['Lámpara de pie moderna', 'Lámpara de pie con base metálica y pantalla de tela.', 365, 6],
      ['Lámpara solar para jardín (set de 4)', 'Lámparas con carga solar y encendido automático.', 155, 15],
      ['Linterna recargable de mano', 'Linterna LED de largo alcance con batería recargable.', 99, 32],
      ['Plafón LED de techo 24 W', 'Panel redondo de luz fría para sala o cocina.', 129, 0],
      ['Luces decorativas de cuerda 10 m', 'Serie de 100 luces cálidas para interior y exterior.', 85, 41]
    ]
  },
  {
    name: 'Jardín',
    products: [
      ['Manguera de jardín 15 m', 'Manguera reforzada con boquilla de 7 funciones.', 189, 19],
      ['Maceta de plástico 30 cm', 'Maceta resistente a la intemperie con plato.', 45, 52],
      ['Juego de herramientas de jardinería 3 piezas', 'Pala, rastrillo y trasplantador de acero.', 95, 28],
      ['Regadera de 5 litros', 'Regadera de plástico con rociador desmontable.', 59.9, 34],
      ['Tierra preparada para plantas 10 kg', 'Sustrato enriquecido, ideal para macetas y jardineras.', 49, 40],
      ['Guantes de jardinería', 'Guantes resistentes a espinas, talla única.', 32, 4],
      ['Tijeras de podar', 'Tijeras de acero con mango acolchado y seguro.', 78, 16],
      ['Malla sombra 4x5 m', 'Malla de polietileno con 80% de sombra.', 235, 9]
    ]
  },
  {
    name: 'Organización y almacenamiento',
    products: [
      ['Caja organizadora transparente 30 L', 'Caja plástica apilable con tapa y broches.', 89.9, 37],
      ['Estantería metálica de 4 niveles', 'Estantería de acero ajustable, soporta 40 kg por nivel.', 345, 7],
      ['Organizador de zapatos 10 pares', 'Organizador de tela con estructura metálica.', 125, 18],
      ['Set de 6 cajas de tela plegables', 'Cajas decorativas para closet y repisas.', 139, 21],
      ['Gancho de pared adhesivo (paquete de 12)', 'Ganchos sin taladro, soportan hasta 3 kg.', 38, 65],
      ['Canasta de mimbre con tapa', 'Canasta de fibra natural, ideal para lavandería.', 165, 12],
      ['Bolsas al vacío (paquete de 8)', 'Bolsas para ropa y cobijas, incluyen bomba manual.', 99, 26],
      ['Gabinete multiusos plástico', 'Gabinete de 3 cajones con ruedas.', 285, 0]
    ]
  },
  {
    name: 'Productos para niños y regalos',
    products: [
      ['Lonchera térmica infantil', 'Lonchera con aislante y bolsillo frontal.', 79.9, 30],
      ['Set de vasos y platos infantiles', 'Juego de 5 piezas libres de BPA.', 69, 25],
      ['Mochila escolar ergonómica', 'Mochila con respaldo acolchado y compartimento para laptop.', 215, 14],
      ['Rompecabezas de 100 piezas', 'Rompecabezas con diseño de animales para armar en familia.', 55, 44],
      ['Caja de regalo decorada mediana', 'Caja con tapa y listón, lista para obsequiar.', 35, 58],
      ['Álbum de fotos 100 fotografías', 'Álbum con espacio para anotaciones y portada personalizable.', 89, 19],
      ['Peluche suave 40 cm', 'Peluche hipoalergénico, lavable a máquina.', 125, 3],
      ['Set de papel de regalo (6 pliegos)', 'Papel de regalo con diseños variados y moños.', 29.9, 75]
    ]
  }
];

// Margen de ganancia tipico por categoria (sobre el precio de venta). Formula del margen:
//   precio = costo / (1 - margen)   =>   costo = precio x (1 - margen)
// El costo y el precio ya incluyen IVA, por eso no se calcula ningun impuesto.
const MARGIN_BY_CATEGORY = {
  'Hogar y decoración': 0.30,
  'Cocina': 0.28,
  'Dormitorio': 0.28,
  'Baño': 0.27,
  'Limpieza': 0.25,
  'Ferretería y herramientas': 0.22,
  'Iluminación': 0.30,
  'Jardín': 0.27,
  'Organización y almacenamiento': 0.30,
  'Productos para niños y regalos': 0.33
};
function costFromPrice(price, categoryName) {
  const margin = MARGIN_BY_CATEGORY[categoryName] ?? 0.28;
  return Number((price * (1 - margin)).toFixed(2));
}

const INACTIVE_PRODUCTS = new Set(['Peluche suave 40 cm', 'Cepillo para sanitario con base']); // ejemplos de productos ocultos

// production=true (npm run db:seed:prod): solo catálogo y un administrador real tomado de ADMIN_EMAIL y
// ADMIN_PASSWORD; sin usuarios de prueba ni pedidos de ejemplo, y sin pisar precios ni stock ya existentes.
async function runSeed({ production = false } = {}) {
  console.log('Seeding categorías de Punto Hogar...');
  const categories = [];
  for (const c of CATALOG) {
    const slug = slugify(c.name);
    const imageUrl = `/images/categories/${slug}.svg`;
    const cat = await prisma.category.upsert({
      where: { slug },
      update: { name: c.name, imageUrl, active: true },
      create: { name: c.name, slug, imageUrl }
    });
    categories.push({ ...cat, categoryName: c.name, products: c.products });
  }

  console.log('Seeding usuarios...');
  let admin, user;
  if (production) {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || password.length < 8) {
      // Sin credenciales no se crea administrador, pero el deploy sigue: se reutiliza uno existente si lo hay.
      console.warn('Aviso: ADMIN_EMAIL/ADMIN_PASSWORD no definidos (o contraseña < 8 caracteres); no se crea administrador.');
      admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      // Si el administrador ya existe no se cambia su contraseña: un nuevo deploy no debe pisarla.
      admin = await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN' },
        create: { email, name: 'Administrador', passwordHash, role: 'ADMIN' }
      });
    }
  } else {
    admin = await upsertUser({ name: 'Administrador', email: 'admin@test.com', password: 'admin1234', role: 'ADMIN' });
    user = await upsertUser({ name: 'Cliente de prueba', email: 'test@test.com', password: 'test1234', role: 'USER' });
  }

  console.log('Seeding productos...');
  let total = 0;
  for (const cat of categories) {
    for (const [name, description, price, stock] of cat.products) {
      const slug = slugify(name);
      const active = !INACTIVE_PRODUCTS.has(name);
      const costPrice = costFromPrice(price, cat.categoryName);
      // Foto real del producto (public/products/<slug>.webp, ver CREDITS.md); si no hay, se usa la tarjeta de su categoría.
      const photo = fs.existsSync(path.join(__dirname, '..', 'public', 'products', `${slug}.webp`)) ? `/products/${slug}.webp` : `/images/categories/${cat.slug}.svg`;
      await prisma.product.upsert({
        where: { slug },
        // en producción un nuevo deploy no debe devolver precio ni stock a los valores de ejemplo
        update: production ? {} : { name, description, price, costPrice, stock, active, categoryId: cat.id, imageUrl: photo },
        create: { name, slug, description, price, costPrice, stock, active, categoryId: cat.id, userId: admin?.id, imageUrl: photo }
      });
      total++;
    }
  }
  console.log(`Productos cargados: ${total}`);

  // ------------------------------------------------------------------
  // Pedidos de ejemplo (6 meses hacia atrás) para alimentar el dashboard y el historial del cliente de prueba.
  // Son datos históricos: no descuentan inventario.
  // ------------------------------------------------------------------
  const existingOrders = production ? -1 : await prisma.order.count();
  if (production) {
    console.log('Producción: no se generan pedidos de ejemplo.');
  } else if (existingOrders > 0) {
    console.log(`Órdenes existentes (${existingOrders}) -> se omite generación de órdenes.`);
  } else {
    console.log('Generando pedidos de ejemplo (3 por día, últimos 6 meses)...');
    const products = await prisma.product.findMany({ where: { active: true }, select: { id: true, price: true, costPrice: true, name: true, slug: true } });
    if (products.length === 0) {
      console.warn('No hay productos, no se pueden generar órdenes.');
    } else {
      const end = new Date();
      const startRange = new Date();
      startRange.setMonth(end.getMonth() - 6);
      startRange.setHours(0, 0, 0, 0);

      const STATUS_WEIGHTS = [
        { status: 'COMPLETED', w: 40 },
        { status: 'PAID', w: 20 },
        { status: 'SHIPPED', w: 15 },
        { status: 'PENDING', w: 15 },
        { status: 'CANCELED', w: 10 }
      ];
      const weightSum = STATUS_WEIGHTS.reduce((a, b) => a + b.w, 0);
      function pickStatus(r) {
        let acc = 0;
        for (const s of STATUS_WEIGHTS) { acc += s.w; if (r * weightSum < acc) return s.status; }
        return 'PENDING';
      }
      function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

      const ordersToCreate = [];
      let counter = 0;
      for (let d = new Date(startRange.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
        for (let i = 0; i < 3; i++) {
          counter++;
          const createdAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), randomInt(7, 21), randomInt(0, 59), randomInt(0, 59));
          if (createdAt > end) continue;
          const itemCount = randomInt(1, 4);
          const used = new Set();
          const items = [];
          for (let j = 0; j < itemCount; j++) {
            let idx = randomInt(0, products.length - 1);
            let guard = 0;
            while (used.has(idx) && guard++ < 10) idx = randomInt(0, products.length - 1);
            used.add(idx);
            const p = products[idx];
            items.push({ productId: p.id, name: p.name, slug: p.slug, unitPrice: p.price, unitCost: p.costPrice, quantity: randomInt(1, 3) });
          }
          const subtotal = Number(items.reduce((sum, it) => sum + Number(it.unitPrice) * it.quantity, 0).toFixed(2));
          const isDemoUser = counter % 40 === 0; // algunos pedidos pertenecen al cliente de prueba (historial)
          const customerIndex = randomInt(1, 600);
          ordersToCreate.push({
            customer: isDemoUser ? 'Cliente de prueba' : `Cliente ${customerIndex}`,
            email: isDemoUser ? user.email : `cliente${customerIndex}@test.com`,
            address: `${randomInt(1, 20)} avenida ${randomInt(1, 15)}-${randomInt(10, 99)}, zona ${randomInt(1, 18)}, Ciudad de Guatemala`,
            subtotal,
            total: subtotal, // los precios ya incluyen IVA
            createdAt,
            phone: `+502 ${randomInt(4000, 5999)}-${randomInt(1000, 9999)}`,
            status: pickStatus(Math.random()),
            userId: isDemoUser ? user.id : undefined,
            items
          });
        }
      }

      console.log(`Preparados ${ordersToCreate.length} pedidos. Insertando...`);
      const batchSize = 40;
      for (let start = 0; start < ordersToCreate.length; start += batchSize) {
        const slice = ordersToCreate.slice(start, start + batchSize);
        await prisma.$transaction(
          slice.map(o =>
            prisma.order.create({
              data: {
                customer: o.customer,
                email: o.email,
                address: o.address,
                subtotal: o.subtotal,
                total: o.total,
                createdAt: o.createdAt,
                phone: o.phone,
                status: o.status,
                userId: o.userId,
                items: { create: o.items }
              }
            })
          )
        );
      }
      console.log(`Pedidos insertados: ${ordersToCreate.length}`);
    }
  }

  console.log('Seed completado.');
}

// Export para uso programático
module.exports = { runSeed, prisma };

// Ejecución directa desde CLI
if (require.main === module) {
  runSeed()
    .catch(e => {
      console.error('Error en seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
