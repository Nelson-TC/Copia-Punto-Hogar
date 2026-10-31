// Datos de demostración: simula ~2 años de operación de la tienda (clientes registrados, pedidos con
// crecimiento y temporadas, estados realistas y bitácora de auditoría) para que el panel y las estadísticas
// se vean como los de un negocio en funcionamiento.
//
// Se ejecuta una sola vez por versión: deja una marca en AuditLog (action "seed.demo", metadata.version).
// Al subir DEMO_VERSION se borran los datos de demo anteriores y se regeneran.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEMO_VERSION = 2;
const MONTHS_OF_HISTORY = 24;
const DEMO_DOMAIN_TAG = 'demo'; // metadata para reconocer usuarios generados en AuditLog

const FIRST_NAMES = [
  'María', 'José', 'Juan', 'Ana', 'Carlos', 'Luis', 'Rosa', 'Jorge', 'Carmen', 'Mario', 'Sofía', 'Andrea',
  'Daniel', 'Gabriela', 'Fernando', 'Lucía', 'Diego', 'Paola', 'Alejandro', 'Valeria', 'Ricardo', 'Mónica',
  'Pedro', 'Claudia', 'Javier', 'Karla', 'Miguel', 'Lorena', 'Óscar', 'Silvia', 'Roberto', 'Diana', 'Erick',
  'Alejandra', 'Héctor', 'Patricia', 'Edgar', 'Wendy', 'Kevin', 'Jennifer', 'Manuel', 'Beatriz', 'Sergio',
  'Fátima', 'Cristian', 'Ingrid', 'Julio', 'Marta', 'Byron', 'Leticia', 'Estuardo', 'Mariela', 'Rodrigo', 'Elena'
];
const LAST_NAMES = [
  'López', 'García', 'Pérez', 'Hernández', 'Martínez', 'González', 'Rodríguez', 'Morales', 'Ramírez', 'Castillo',
  'Juárez', 'Méndez', 'Reyes', 'Cruz', 'Flores', 'Gómez', 'Ortiz', 'Vásquez', 'Díaz', 'Barrios', 'Mejía',
  'Rivera', 'Estrada', 'Aguilar', 'Sandoval', 'Monterroso', 'Orellana', 'Solís', 'Cifuentes', 'Arévalo',
  'Chávez', 'Recinos', 'Paz', 'Cabrera', 'Fuentes', 'Ruiz', 'Lima', 'Coronado', 'Velásquez', 'Ajú'
];
const EMAIL_DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
const LOCATIONS = [
  ['Ciudad de Guatemala', [1, 2, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18]],
  ['Mixco', [1, 3, 4, 6, 7, 8, 10, 11]],
  ['Villa Nueva', [1, 3, 4, 5, 8]],
  ['San Miguel Petapa', [1, 4, 7]],
  ['Santa Catarina Pinula', [1, 4]],
  ['Fraijanes', [1]],
  ['Antigua Guatemala', [0]],
  ['Chimaltenango', [0]],
  ['Escuintla', [0]],
  ['Quetzaltenango', [1, 3, 5]]
];

// Generador pseudoaleatorio con semilla: los datos son iguales en cada regeneración.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function poisson(rand, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// Multiplicador estacional por mes (0 = enero). Guatemala: Día de la Madre (10 de mayo), Bono 14 (julio),
// Black Friday (noviembre) y aguinaldo/Navidad (diciembre).
const MONTH_FACTOR = [0.8, 0.82, 0.92, 0.95, 1.2, 0.97, 1.08, 0.98, 0.95, 1.0, 1.3, 1.6];
const WEEKDAY_FACTOR = [1.25, 0.85, 0.9, 0.95, 1.0, 1.15, 1.35]; // domingo..sábado

function dayFactor(d) {
  let f = MONTH_FACTOR[d.getMonth()] * WEEKDAY_FACTOR[d.getDay()];
  const m = d.getMonth(), day = d.getDate();
  if (m === 4 && day >= 3 && day <= 10) f *= 1.6; // semana del Día de la Madre
  if (m === 10 && day >= 22 && day <= 30) f *= 1.7; // Black Friday
  if (m === 11 && day >= 15 && day <= 24) f *= 1.4; // compras navideñas
  if (m === 11 && day === 25) f *= 0.3;
  if (m === 0 && day === 1) f *= 0.3;
  return f;
}

function pickStatus(rand, ageDays) {
  const r = rand();
  if (ageDays <= 1) return r < 0.55 ? 'PENDING' : r < 0.9 ? 'PAID' : 'CANCELED';
  if (ageDays <= 4) return r < 0.15 ? 'PENDING' : r < 0.45 ? 'PAID' : r < 0.93 ? 'SHIPPED' : 'CANCELED';
  if (ageDays <= 10) return r < 0.1 ? 'PAID' : r < 0.35 ? 'SHIPPED' : r < 0.93 ? 'COMPLETED' : 'CANCELED';
  return r < 0.925 ? 'COMPLETED' : 'CANCELED';
}

async function removePreviousDemo(prisma) {
  // Versión 1 del seed: pedidos con correos @test.com y clientes "Cliente N".
  const legacy = { email: { endsWith: '@test.com' } };
  await prisma.orderItem.deleteMany({ where: { order: legacy } });
  await prisma.order.deleteMany({ where: legacy });

  const marks = await prisma.auditLog.findMany({ where: { action: 'seed.demo' } });
  for (const m of marks) {
    const userIds = (m.metadata && m.metadata.userIds) || [];
    if (userIds.length) {
      await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
      await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const orderIds = (m.metadata && m.metadata.guestOrderIds) || [];
    for (let i = 0; i < orderIds.length; i += 1000) {
      const ids = orderIds.slice(i, i + 1000);
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
  }
  await prisma.auditLog.deleteMany({ where: { metadata: { path: ['source'], equals: DEMO_DOMAIN_TAG } } });
  await prisma.auditLog.deleteMany({ where: { action: 'seed.demo' } });
}

async function seedDemoData(prisma, { admin, demoUser }) {
  const done = await prisma.auditLog.findFirst({
    where: { action: 'seed.demo', metadata: { path: ['version'], equals: DEMO_VERSION } }
  });
  if (done) {
    console.log(`Datos de demostración v${DEMO_VERSION} ya cargados -> se omiten.`);
    return;
  }

  console.log('Limpiando datos de demostración anteriores...');
  await removePreviousDemo(prisma);

  const rand = rng(20240501);
  const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - MONTHS_OF_HISTORY);
  start.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / 86400000);
  const atDay = (dayIndex, hMin = 7, hMax = 21) => {
    const d = new Date(start);
    d.setDate(d.getDate() + dayIndex);
    d.setHours(randInt(hMin, hMax), randInt(0, 59), randInt(0, 59), 0);
    return d > end ? new Date(end.getTime() - randInt(60, 3600) * 1000) : d;
  };

  // El negocio "abrió" al inicio del periodo: catálogo, categorías y cuentas internas con esa antigüedad.
  const opening = new Date(start.getTime() - 20 * 86400000);
  await prisma.category.updateMany({ data: { createdAt: opening } });
  await prisma.product.updateMany({ data: { createdAt: opening } });
  await prisma.user.updateMany({ where: { id: admin.id }, data: { createdAt: new Date(opening.getTime() - 5 * 86400000) } });
  await prisma.user.updateMany({ where: { id: demoUser.id }, data: { createdAt: atDay(40) } });

  // ---------------- Clientes registrados (crecimiento acelerado en el tiempo) ----------------
  console.log('Generando clientes registrados...');
  const CUSTOMER_COUNT = 520;
  const usedEmails = new Set();
  const customers = [];
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const first = pick(FIRST_NAMES);
    const last1 = pick(LAST_NAMES);
    const last2 = pick(LAST_NAMES);
    let email;
    do {
      const style = randInt(0, 3);
      const base = [
        `${stripAccents(first)}.${stripAccents(last1)}`,
        `${stripAccents(first)}${stripAccents(last1)}${randInt(1, 99)}`,
        `${stripAccents(first)[0]}${stripAccents(last1)}${randInt(80, 2005)}`,
        `${stripAccents(first)}_${stripAccents(last2)}`
      ][style];
      email = `${base}@${pick(EMAIL_DOMAINS)}`;
    } while (usedEmails.has(email));
    usedEmails.add(email);
    // Registro sesgado hacia fechas recientes (más clientes cada mes).
    const dayIndex = Math.floor(Math.pow(rand(), 0.75) * totalDays);
    const [city, zones] = pick(LOCATIONS);
    const zone = pick(zones);
    customers.push({
      id: crypto.randomUUID(),
      email,
      name: `${first} ${last1} ${last2}`,
      // Contraseña inutilizable: son cuentas de demostración, nadie puede iniciar sesión con ellas.
      passwordHash: placeholderHash,
      role: 'USER',
      createdAt: atDay(dayIndex),
      dayIndex,
      address: zone
        ? `${randInt(1, 30)} ${pick(['avenida', 'calle'])} ${randInt(1, 40)}-${randInt(10, 99)}, zona ${zone}, ${city}`
        : `${randInt(1, 9)}a ${pick(['avenida', 'calle'])} ${pick(['norte', 'sur', 'oriente', 'poniente'])} #${randInt(1, 60)}, ${city}`,
      phone: `+502 ${pick(['3', '4', '5'])}${randInt(100, 999)}-${randInt(1000, 9999)}`,
      loyalty: Math.pow(rand(), 2.2) // pocos clientes compran mucho
    });
  }
  customers.sort((a, b) => a.dayIndex - b.dayIndex);
  await prisma.user.createMany({
    data: customers.map(({ id, email, name, passwordHash, role, createdAt }) => ({ id, email, name, passwordHash, role, createdAt, updatedAt: createdAt }))
  });

  // ---------------- Pedidos ----------------
  console.log(`Generando pedidos (${MONTHS_OF_HISTORY} meses de historia)...`);
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, price: true, costPrice: true, name: true, slug: true, categoryId: true }
  });
  if (products.length === 0) {
    console.warn('No hay productos, no se pueden generar pedidos.');
    return;
  }
  // Popularidad tipo Zipf con orden fijo: algunos productos son "los más vendidos".
  const ranked = [...products].sort((a, b) => a.slug.localeCompare(b.slug)).map(p => ({ p, r: rand() })).sort((a, b) => a.r - b.r).map(x => x.p);
  const weights = ranked.map((_, i) => 1 / Math.pow(i + 1, 0.85));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const pickProduct = () => {
    let x = rand() * weightSum;
    for (let i = 0; i < ranked.length; i++) { x -= weights[i]; if (x <= 0) return ranked[i]; }
    return ranked[ranked.length - 1];
  };

  const orders = [];
  const items = [];
  const statusLogs = [];
  const guestOrderIds = [];
  let custCursor = 0;
  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);
    const progress = day / totalDays;
    // De ~2 pedidos diarios al abrir a ~11 al día de hoy.
    const base = 2 + 9 * Math.pow(progress, 1.3);
    const n = poisson(rand, base * dayFactor(date));
    while (custCursor < customers.length && customers[custCursor].dayIndex <= day) custCursor++;

    for (let k = 0; k < n; k++) {
      const createdAt = atDay(day, 7, 22);
      if (createdAt > end) continue;
      const ageDays = (end - createdAt) / 86400000;
      let customer = null;
      // ~65 % de pedidos de clientes registrados (más compras de los clientes fieles).
      if (custCursor > 0 && rand() < 0.65) {
        for (let tries = 0; tries < 6; tries++) {
          const c = customers[Math.floor(rand() * custCursor)];
          if (rand() < 0.25 + c.loyalty) { customer = c; break; }
        }
      }
      const isDemo = !customer && rand() < 0.012;
      let name, email, address, phone, userId;
      if (customer) {
        ({ name, email, address, phone } = customer);
        userId = customer.id;
      } else if (isDemo) {
        name = demoUser.name || 'Cliente de prueba';
        email = demoUser.email;
        address = '6a avenida 9-45, zona 10, Ciudad de Guatemala';
        phone = '+502 5512-3478';
        userId = demoUser.id;
      } else {
        const first = pick(FIRST_NAMES), last = pick(LAST_NAMES);
        name = `${first} ${last}`;
        email = `${stripAccents(first)}.${stripAccents(last)}${randInt(1, 999)}@${pick(EMAIL_DOMAINS)}`;
        const [city, zones] = pick(LOCATIONS);
        const zone = pick(zones);
        address = zone ? `${randInt(1, 30)} calle ${randInt(1, 40)}-${randInt(10, 99)}, zona ${zone}, ${city}` : `${randInt(1, 9)}a avenida sur #${randInt(1, 60)}, ${city}`;
        phone = `+502 ${pick(['3', '4', '5'])}${randInt(100, 999)}-${randInt(1000, 9999)}`;
      }

      const orderId = crypto.randomUUID();
      const lineCount = Math.min(products.length, 1 + poisson(rand, 1.1));
      const used = new Set();
      let subtotal = 0;
      for (let j = 0; j < lineCount; j++) {
        let p = pickProduct();
        for (let g = 0; used.has(p.id) && g < 10; g++) p = pickProduct();
        if (used.has(p.id)) continue;
        used.add(p.id);
        const quantity = rand() < 0.72 ? 1 : rand() < 0.75 ? 2 : randInt(3, 5);
        subtotal += Number(p.price) * quantity;
        items.push({ id: crypto.randomUUID(), orderId, productId: p.id, name: p.name, slug: p.slug, unitPrice: p.price, unitCost: p.costPrice, quantity });
      }
      subtotal = Number(subtotal.toFixed(2));
      const status = pickStatus(rand, ageDays);
      orders.push({ id: orderId, customer: name, email, address, phone, subtotal, total: subtotal, createdAt, status, userId: userId || null });
      if (!userId) guestOrderIds.push(orderId);

      // Bitácora: cambios de estado hechos por el administrador en los últimos 60 días.
      if (ageDays <= 60 && status !== 'PENDING') {
        const flow = status === 'CANCELED' ? ['PENDING', 'CANCELED'] : ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED'].slice(0, ['PAID', 'SHIPPED', 'COMPLETED'].indexOf(status) + 2);
        let t = createdAt.getTime();
        for (let s = 1; s < flow.length; s++) {
          t += randInt(2, 30) * 3600 * 1000;
          if (t > end.getTime()) break;
          statusLogs.push({ action: 'order.status.update', entity: 'Order', entityId: orderId, createdAt: new Date(t), metadata: { from: flow[s - 1], to: flow[s], source: DEMO_DOMAIN_TAG } });
        }
      }
    }
  }

  console.log(`Insertando ${orders.length} pedidos y ${items.length} líneas...`);
  for (let i = 0; i < orders.length; i += 1000) await prisma.order.createMany({ data: orders.slice(i, i + 1000) });
  for (let i = 0; i < items.length; i += 2000) await prisma.orderItem.createMany({ data: items.slice(i, i + 2000) });

  // ---------------- Bitácora de administración ----------------
  console.log('Generando bitácora de administración...');
  const audit = statusLogs.map(l => ({ ...l, userId: admin.id }));
  for (let i = 0; i < 140; i++) {
    const p = pick(products);
    const createdAt = atDay(Math.floor(Math.pow(rand(), 0.6) * totalDays), 8, 18);
    if (rand() < 0.6) {
      const from = randInt(0, 6), to = from + randInt(10, 40);
      audit.push({ userId: admin.id, action: 'product.stock.update', entity: 'Product', entityId: p.id, createdAt, metadata: { from, to, source: DEMO_DOMAIN_TAG } });
    } else {
      audit.push({ userId: admin.id, action: 'product.update', entity: 'Product', entityId: p.id, createdAt, metadata: { name: p.name, costPrice: Number(p.costPrice), source: DEMO_DOMAIN_TAG } });
    }
  }
  for (let i = 0; i < 12; i++) {
    audit.push({ userId: admin.id, action: 'category.update', entity: 'Category', entityId: pick(products).categoryId, createdAt: atDay(randInt(0, totalDays), 8, 18), metadata: { source: DEMO_DOMAIN_TAG } });
  }
  for (let i = 0; i < audit.length; i += 2000) await prisma.auditLog.createMany({ data: audit.slice(i, i + 2000) });

  await prisma.auditLog.create({
    data: {
      createdAt: opening,
      action: 'seed.demo',
      entity: 'Seed',
      metadata: { version: DEMO_VERSION, userIds: customers.map(c => c.id), guestOrderIds }
    }
  });
  const revenue = orders.filter(o => o.status !== 'CANCELED').reduce((s, o) => s + o.total, 0);
  console.log(`Demo lista: ${customers.length} clientes, ${orders.length} pedidos, Q${revenue.toFixed(2)} en ventas, ${audit.length} registros de bitácora.`);
}

module.exports = { seedDemoData };
