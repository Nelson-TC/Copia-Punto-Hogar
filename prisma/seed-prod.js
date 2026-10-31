// Seed de producción: catálogo, usuarios de prueba (admin@test.com), pedidos de ejemplo y roles/permisos. Es repetible.
// Requiere DATABASE_URL. Uso: npm run db:seed:prod
const { runSeed, prisma } = require('./seed');

runSeed({ production: true })
  .then(async () => {
    await prisma.$disconnect();
    // El seed de roles va al final: vincula al administrador recién creado con el rol "admin".
    require('./seed-rbac');
  })
  .catch(async e => {
    console.error('Error en seed de producción:', e.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
