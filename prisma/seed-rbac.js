// RBAC seed script (JavaScript version)
// Run with: node prisma/seed-rbac.js
// Ensure DATABASE_URL is set in environment.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PERMISSIONS = [
  'admin:access',
  'dashboard:access',
  'dashboard:export',
  'product:read','product:create','product:update','product:delete',
  'category:read','category:create','category:update','category:delete',
  'order:read','order:manageStatus',
  'user:read','user:create','user:update','user:delete',
  'role:read','role:update',
  'audit:read'
];

const ROLES = {
  admin: PERMISSIONS,
  // Gestor de tienda: opera catálogo, inventario y pedidos, pero NO administra usuarios ni roles
  // (regla de negocio: solo el rol Administrador gestiona usuarios; "admin:access" es acceso total).
  manager: [
    'dashboard:access',
    'product:read','product:create','product:update','product:delete',
    'category:read','category:create','category:update','category:delete',
    'order:read','order:manageStatus',
    'audit:read'
  ],
  support: ['product:read','category:read','order:read'],
  viewer: ['product:read','category:read']
};

async function main() {
  console.log('Seeding RBAC (permissions & roles)...');

  // Upsert permissions
  const permMap = {}; // key -> id
  for (const key of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key }
    });
    permMap[key] = p.id;
  }

  // Upsert roles and assign permissions
  for (const [name, perms] of Object.entries(ROLES)) {
    const r = await prisma.roleEntity.upsert({
      where: { name },
      update: {},
      create: { name, label: name.toUpperCase() }
    });

    // Reset role permissions (idempotent behavior)
    await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });

    if (perms.length) {
      await prisma.rolePermission.createMany({
        data: perms.map(k => ({ roleId: r.id, permissionId: permMap[k] }))
      });
    }
  }

  // Map legacy enum ADMIN users to admin role through junction table
  const adminRole = await prisma.roleEntity.findUnique({ where: { name: 'admin' } });
  if (adminRole) {
    const legacyAdmins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const u of legacyAdmins) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: adminRole.id } },
        update: {},
        create: { userId: u.id, roleId: adminRole.id }
      });
    }
  }

  console.log('RBAC seed completed');
}

main()
  .catch(e => {
    console.error('Error in RBAC seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
