# Guía de Despliegue

## Variables de Entorno
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| DATABASE_URL | Conexión PostgreSQL | postgres://user:pass@host:5432/db |
| JWT_SECRET | Clave firma JWT | cambiar_por_valor_largo |
| NODE_ENV | `production` en build prod | production |

Crear `.env` (no commitear) y configurar en plataforma (Vercel / DO / Render).

## Pasos Generales (Vercel)
1. Importar repositorio.
2. Añadir `DATABASE_URL` y `JWT_SECRET` en Project Settings.
3. Build automático: `npm install && npx prisma generate && npm run build`.
4. Post-deploy (opcional) ejecutar migraciones manualmente (o usar hook):
```
npx prisma migrate deploy
node prisma/seed.js
```
5. Verificar logs y probar `/api/health` (crear si se desea).

## DigitalOcean App Platform
Build Command:
```
npm install && npx prisma generate && npm run build
```
Run Command:
```
npm start
```
Deploy Command (migraciones + seed opcional):
```
npx prisma migrate deploy && node prisma/seed.js || true
```

## Docker (Ejemplo Básico)
`Dockerfile` (crear si se requiere):
```
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
CMD ["npm","start"]
```

Docker Compose junto a Postgres:
```
version: '3.9'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: punto_hogar
    ports: ["5432:5432"]
  web:
    build: .
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/punto_hogar
      JWT_SECRET: cambia_esto
    ports: ["3000:3000"]
    depends_on: [db]
```

## Migraciones en CI/CD
- Paso antes de levantar contenedor: `npx prisma migrate deploy`.
- En pipelines con zero-downtime usar estrategia: migrar -> build -> swap tráfico.

## Observabilidad / Logs
- Agregar `pino` o `winston` para logs estructurados.
- Integrar con plataforma (Datadog / Grafana Loki) usando stdout.

## Hardening
- Usar cabeceras: `Content-Security-Policy`, `X-Frame-Options`, etc. (middleware futuro).
- Rotar `JWT_SECRET` y revocar sesiones (agregar campo `tokenVersion` si se implementa lista negra).

## Escalado
- Stateless: múltiples instancias pueden servir tráfico (carrito en cookie, no en memoria).
- DB: habilitar connection pooling (pgBouncer / DO pooler).
- Cache de lectura futuro: Redis para productos populares + tag revalidation.

## Checklist Pre‑Producción
- [ ] Variables de entorno definidas
- [ ] Migraciones ejecutadas
- [ ] Seed (opcional) corrido
- [ ] Logs verificados
- [ ] Monitoreo / uptime configurado
- [ ] Backups DB programados
- [ ] Revisión de permisos / roles (`docs/rbac.md`)
- [ ] Validación visual dashboard en breakpoints clave (414px, 768px, 1280px, 1536px)
