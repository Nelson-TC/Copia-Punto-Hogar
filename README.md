<div align="center">
  <img src="public/images/logo.webp" alt="Punto Hogar" width="220" />

  # Punto Hogar
  **Plataforma de comercio electrónico para artículos del hogar**

  Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL · JWT Auth
</div>

Proyecto del curso **Aseguramiento de la Calidad de Software** (Universidad Mariano Gálvez, Centro Universitario de Chimaltenango).
Es una tienda por departamentos en línea —al estilo de Cemaco o Max Bodega— con catálogo por categorías, carrito,
pedidos con control de inventario y un panel administrativo con roles y permisos.

## Tabla de Contenidos
1. [Características](#características)
2. [Reglas de negocio](#reglas-de-negocio)
3. [Instalación rápida](#instalación-rápida)
4. [Usuarios de prueba](#usuarios-de-prueba)
5. [Scripts principales](#scripts-principales)
6. [Modelo de datos](#modelo-de-datos)
7. [Manejo de errores y fallas simuladas](#manejo-de-errores-y-fallas-simuladas)
8. [Documentación](#documentación)

## Características
**Cliente**
- Catálogo con 10 categorías: hogar y decoración, cocina, dormitorio, baño, limpieza, ferretería y herramientas,
  iluminación, jardín, organización y almacenamiento, productos para niños y regalos.
- Búsqueda por nombre, filtros por categoría y rango de precio, y ordenamiento (`/products`, `/search`).
- Detalle de producto con disponibilidad (`Disponible`, `Quedan N`, `Agotado`).
- Carrito que valida el stock, recalcula subtotales y total, y permite modificar o eliminar productos.
- Pedido para usuarios con sesión: valida existencias y descuenta el inventario en una sola transacción.
- Historial de pedidos con fecha, productos, total y estado.

**Administrador**
- CRUD de productos (con imagen, **stock**, **costo** y **margen de ganancia**), actualización rápida de existencias y filtro de stock bajo/agotado.
- Costo, margen y precio de venta ligados: se escribe el margen y se calcula el precio, o se escribe el precio y se calcula el margen, con el desglose de IVA y ganancia en vivo.
- Gestión de categorías, pedidos (con cambio de estado), usuarios y roles.
- Dashboard de métricas y log de auditoría.

## Reglas de negocio
- No se puede agregar al carrito más cantidad de la que hay en inventario.
- Un pedido no puede confirmarse con el carrito vacío ni sin una sesión iniciada.
- El stock solo se descuenta al confirmar el pedido, dentro de una transacción atómica de Prisma
  (si falta inventario no se crea el pedido y no se descuenta nada).
- El precio aplicado es el vigente al comprar; cambiarlo después no afecta pedidos ya confirmados.
- Un producto inactivo no se muestra al cliente aunque tenga existencias.
- Una categoría con productos asociados no puede eliminarse; un producto con pedidos no puede borrarse (se desactiva).
- Al cancelar un pedido se devuelve el inventario; un pedido cancelado no puede reactivarse.
- Solo el rol **Administrador** gestiona usuarios y roles; solo él puede otorgar o retirar el rol de administrador.
- Los precios publicados incluyen IVA (Q, quetzales) y el **costo** también: no se calcula ni se separa el IVA. El costo es información interna y nunca se envía al cliente.
- **Margen de ganancia** = (precio − costo) / precio, y el precio se obtiene con `precio = costo / (1 − margen)`. Ejemplo: costo Q70 y margen 30 % → precio Q100, ganancia Q30.
- Cada línea de pedido guarda el costo vigente al vender (`unitCost`), así la ganancia histórica no cambia si el costo se actualiza después.

## Instalación rápida
Requisitos: Node 18+ y PostgreSQL.
```bash
git clone <URL-DE-TU-REPOSITORIO>
cd punto-hogar
npm install
```
Crear un archivo `.env` con:
```
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/punto_hogar?schema=public"
JWT_SECRET="un-texto-largo-y-aleatorio"
CORS_ORIGINS="http://localhost:3000"
```
Crear la base de datos vacía, aplicar migraciones y cargar los datos de ejemplo:
```bash
psql -U postgres -c "CREATE DATABASE punto_hogar;"
npx prisma migrate deploy
npm run db:seed        # categorías, productos con stock y pedidos de ejemplo
npm run db:seed:rbac   # permisos y roles
npm run dev
```
Abrir http://localhost:3000. Para volver a empezar de cero: `npm run db:reset-seed`.

## Usuarios de prueba
Creados por el seed (solo para desarrollo local):

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | `admin@test.com` | `admin1234` |
| Cliente | `test@test.com` | `test1234` |

El seed incluye productos agotados (stock 0), con stock bajo e inactivos para poder probar esos escenarios.

**Fotos de los productos:** `public/products/` contiene fotografías de ejemplo con licencia libre (Wikimedia Commons: CC0, dominio público, CC BY y CC BY-SA). Los autores y licencias están en `public/products/CREDITS.md` y en la página `/credits`. Si un producto no tiene foto se muestra la tarjeta de su categoría. Desde el panel de administración se puede subir la foto real de cada producto.

## Scripts principales
| Script | Acción |
|--------|--------|
| `dev` | Servidor de desarrollo |
| `build` / `start` | Compila y sirve producción |
| `lint` | ESLint (reglas de Next.js) |
| `prisma:migrate` | Migraciones en desarrollo |
| `prisma:studio` | Explorar la base de datos |
| `db:seed` | Semilla de catálogo, usuarios y pedidos |
| `db:seed:rbac` | Semilla de roles y permisos |
| `db:reset-seed` | Borra los datos y vuelve a sembrar |

## Modelo de datos
Resumen (ver `prisma/schema.prisma`):

| Entidad | Campos clave | Relaciones |
|---------|--------------|-----------|
| User | id, email, passwordHash | roles, orders |
| RoleEntity / Permission | name, key | control de acceso por rol (RBAC) |
| Category | id, name, slug, active | products |
| Product | id, name, slug, price, **costPrice**, **stock**, active | category, orderItems |
| Order | id, customer, subtotal, total, status, createdAt | items, user |
| OrderItem | quantity, unitPrice y unitCost (precio y costo al comprar) | order, product |

`stock` tiene una restricción `CHECK (stock >= 0)` en la base de datos como última línea de defensa.

## Manejo de errores y fallas simuladas
- Validación en cliente **y** en servidor (precio > 0, stock entero ≥ 0, campos obligatorios, formato de correo,
  contraseña de al menos 8 caracteres). El servidor rechaza peticiones inválidas aunque se omita el frontend.
- Códigos HTTP: `400` datos inválidos, `401` sin sesión, `403` sin permiso, `404` no existe, `409` conflicto
  (stock insuficiente, duplicados, categoría con productos), `422` validación de formularios, `503` base de datos caída, `500` error interno.
- Si PostgreSQL no responde, la API devuelve `503` con el mensaje *"No fue posible conectar con el servidor"* y las páginas
  muestran una pantalla de error con botón **Reintentar** (`app/error.tsx`); la aplicación no se cierra.
- Las peticiones del navegador tienen un tiempo máximo de espera (15 s) y avisan al usuario para que pueda reintentar.
- El acceso de un cliente a `/admin` lo devuelve al catálogo; sin sesión lo manda a iniciar sesión.
- Los errores no controlados se registran en el servidor sin exponer detalles técnicos al cliente.

## Documentación
- `docs/arquitectura.md`, `docs/api.md`, `docs/auth-cart.md`, `docs/rbac.md`
- `docs/despliegue.md`, `docs/manual-tecnico.md`
- OpenAPI en `public/openapi.yaml` (visor en `/api-docs.html`)

## Licencia
MIT
