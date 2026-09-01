# Admin Locaciones

Base inicial del panel administrativo para una plataforma de locaciones audiovisuales.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS v4
- Supabase
- React Router

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

## Sentry

El monitoreo de errores del admin se activa solo en builds de producción cuando
`VITE_SENTRY_DSN` tiene valor. Configurá ese DSN del proyecto Sentry exclusivo
del admin como variable de entorno en Vercel.

El build actual no genera ni sube source maps. Para habilitarlos en Sentry hay
que agregar el plugin oficial de Vite y configurar, únicamente en el entorno de
build, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT`. No hay valores
definidos en este repositorio: deben corresponder al proyecto Sentry del admin.
