# Autenticación y Carrito

## Sesiones
- Cookie `session`: JWT firmado HS256 (libs `jose`), contiene `{ sub, email, role }`.
- Expiración: 7 días (`COOKIE_MAX_AGE`). Renovación implica re-login (sin refresh token).
- Cookie `auth_user_id`: usada por helper `getCurrentUser` (legado). Puede eliminarse reemplazando lógica por verificación del JWT.

### Creación de Sesión
1. Usuario se registra o logea (`/api/auth/register` o `/api/auth/login`).
2. Se valida email/password.
3. Se firma JWT y se setea `session` (httpOnly, sameSite=lax, secure en prod).
4. El cliente (AuthProvider) pide `/api/auth/me` para hidratar estado.

### Logout
`POST /api/auth/logout` elimina cookies de sesión y dispara en cliente un refresco del estado (via `auth:changed`).

## `AuthProvider`
- Usa `fetch('/api/auth/me')` al montar.
- Expone `{ session, loading, logout }`.
- Dispara y escucha eventos para mantener navbar y otros componentes sincronizados.

## Carrito (Guest-Friendly)
- Cookie legible `cart` (no httpOnly) para que el cliente pueda leer y mandar eventos sin llamada extra.
- Estructura: `{ items: [{ productId, qty }] }`.
- Límite total (`MAX_ITEMS=100`) y por item (`MAX_PER_ITEM=50`).

### Flujo Add to Cart
1. Botón ejecuta `addToCart(productId)` (client helper).
2. Llama `POST /api/cart` (valida existencia de producto y límites).
3. Servidor actualiza cookie `cart`.
4. Respuesta incluye carrito enriquecido; helper emite `cart:updated`.
5. Navbar escucha evento y refresca badge.

### Pedidos (requieren sesión)
- Endpoint `/api/orders` exige sesión iniciada (`401` si no la hay), lee la cookie `cart` y valida los campos de checkout (`422`).
- Todo ocurre en **una transacción de Prisma**: por cada producto se hace un descuento condicional
  (`stock >= cantidad`); si alguno no alcanza se revierte todo y se responde `409` con la lista de productos sin existencias.
- El precio se toma de la base de datos en ese momento (precio vigente) y se guarda en `OrderItem.unitPrice`.
- El pedido queda asociado al usuario (`userId`) y se limpia el carrito.
- El checkout (`/checkout`) redirige a `/login?next=/checkout` si no hay sesión.

### Validación de stock en el carrito
- `POST /api/cart` y `PUT /api/cart` rechazan (`409`) cantidades mayores al stock y productos agotados, y (`404`) productos inactivos.
- `GET /api/cart` devuelve `stock` por línea y `issues[]` con los productos que ya no alcanzan (el carrito bloquea el pago hasta ajustarlos).

## Migración Futura a Carrito Persistente
Pasos sugeridos:
1. Crear tabla `Cart` y `CartItem` relacionadas a `User`.
2. Al logear, merge cookie -> DB.
3. Middleware unifica fuente de verdad (DB) y sincroniza cookie para visitantes.
4. Invalidar cache con `revalidateTag('cart:userId')`.

## Seguridad / Riesgos
- Manipulación cliente de cookie podría inflar cantidades: mitigado por validaciones en servidor (límites y existencia producto).
- No hay CSRF tokens: operaciones basadas en cookie no cambian datos sensibles de usuario (sólo carrito). Con auth crítica se recomienda añadir CSRF o usar doble submit.
- JWT secreto debe rotarse y moverse a variable de entorno segura.

## Eventos Custom
| Evento | Emisor | Uso |
|--------|--------|-----|
| `cart:updated` | Helpers cart.ts | Refrescar badge e interfaces relacionadas |
| `auth:changed` | AuthProvider/logout | Re-hidratar sesión y mostrar/ocultar links |

## Errores Típicos
- `El producto no está disponible`: producto inexistente o inactivo -> revisar seed/migraciones.
- `Solo hay N unidades disponibles de ...`: la cantidad supera el stock; ajustar el carrito.
- `Limite total superado`: indicar al usuario reducir cantidades.
- `Carrito vacío` al crear orden: cookie reseteada o expiró -> pedir volver a agregar.
