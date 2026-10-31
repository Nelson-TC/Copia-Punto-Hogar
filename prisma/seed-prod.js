// Seed de producción: catálogo + administrador real + roles y permisos. Es repetible (idempotente).
// Requiere DATABASE_URL, ADMIN_EMAIL y ADMIN_PASSWORD. Uso: npm run db:seed:prod
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
