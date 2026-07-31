# Minisúper POS

Programa de escritorio para punto de venta, caja e inventario de un minisúper.

## Estructura

```text
apps/backend     API local con Node.js, Express y Prisma
apps/desktop     Aplicación de escritorio con Electron y React
packages/shared  Constantes y validaciones compartidas
docs             Decisiones y documentación del proyecto
```

## Requisitos

- Node.js 22.12 o superior.
- npm 11 o superior.
- PostgreSQL, cuando iniciemos el modelo de datos.

## Primer inicio

```bash
npm install
npm run dev
```

El backend se ejecuta en `http://127.0.0.1:3001` y Vite usa
`http://127.0.0.1:5173` durante el desarrollo.

## Comandos

```bash
npm run dev
npm run dev:backend
npm run dev:desktop
npm run test
npm run build
npm run prisma:generate
```
