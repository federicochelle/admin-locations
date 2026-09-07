# Observabilidad del admin — Fase 1

Implementación frontend, sin cambios de persistencia, UX, retries, RLS, DB,
Cloudflare ni despliegues. No añade dependencias. No instrumenta Auth ni el resto
del admin en forma masiva.

## Configuración

`src/main.tsx` mantiene la condición `PROD && VITE_SENTRY_DSN` y los tres handlers
React existentes, con `sendDefaultPii: false`. Añade `beforeSend` y la variable
opcional `VITE_APP_RELEASE` (versión/commit real que debe proporcionar CI).
`environment` continúa siendo `MODE`: no hay información fiable en este checkout
para distinguir production/preview. No se habilita captura de consola ni HTTP.
No se generan/suben source maps. La recepción real en Vercel/Sentry debe comprobarse
con el despliegue autorizado; las pruebas de esta fase no envían eventos.

## API y responsabilidad

`src/lib/admin-error-reporting.ts`:

- `reportAdminError(error: unknown, context: AdminErrorContext)` reporta sin lanzar
  aunque falle el SDK. `createAdminErrorReporter` permite inyectar un SDK simulado.
- `normalizeAdminError` conserva la identidad de un Error si no cambia su mensaje;
  para objetos Supabase y mensajes de UI diferentes conserva el original en `cause`.
- `annotateAdminError`/`withAdminErrorStage` adjuntan metadata en un WeakMap privado,
  sin serializar ni modificar propiedades del error original. Conservan etapa,
  proveedor, ID y checkpoints conocidos. Las etapas internas más precisas prevalecen.
- `createAdminCorrelationId` produce UUID por guardado/eliminación y por lote o
  acción independiente de imágenes. Si la API del navegador falla, no bloquea UI.
- `markExpectedAdminError` excluye validaciones previstas de formato/tamaño.
- `suppressAdminErrorReport` excluye únicamente el resumen UI de un lote que ya
  reportó sus errores individuales. No se agrega otro evento por el mismo lote.

Los servicios propagan y no reportan errores principales. El catch que maneja el
fallo en UI/hook es responsable de reportarlo. Los fallos de activity log absorbidos
se reportan allí como warning. Refrescar imágenes sigue resolviendo su Promise aun
si falla; el hook reporta, su caller no duplica. El reporter deduplica por identidad
de Error/objeto y sus causas (WeakSet), no por mensaje ni por ID del recurso: dos
intentos independientes pueden producir dos eventos. No se deduplican errores
legítimos de archivos distintos por compartir etapa. Los errores se conservan en
memoria; el saneamiento se hace sobre la copia del evento de salida.

Se usa `captureException` para errores técnicos. `captureMessage` sólo se usa si no
hay excepción (`null`/`undefined`) y el caller indica un resultado parcial/invariante.
Actualmente el guardado no emite un resumen agregado adicional.

## Datos permitidos y saneamiento

Tags permitidos: operation, module=locations, resource_type, stage, provider,
http_status, supabase_code, retryable, user_facing, outcome. Operaciones, etapas,
proveedores y tipos pasan por listas explícitas; status y códigos se validan.
`retryable` queda unknown cuando no existe evidencia; no habilita retries.

Contexto permitido: location_id (UUID técnico), ruta normalizada sin query/hash,
correlation_id (UUID), image_count, image_mime, image_bytes, image_index,
image_dimensions (sólo width/height), confirmed_stages, failed_stage, attempt,
duration_ms, timeout_ms. Los campos adicionales desconocidos se descartan.
No se envían IDs de personas ni valores de formulario. No enviar objetos arbitrarios
mediante extraSafeContext: el helper los descarta.

`sanitizeAdminSentryEvent`, aplicado también a eventos automáticos React/globales,
reconstruye el evento mediante una lista permitida. Elimina request completo
(incluidos Authorization/headers, cookies, URL y body), user, extra, breadcrumbs,
contexts no permitidos, textos originales de mensajes/excepciones, adjuntos de
contexto de código, variables locales y campos arbitrarios. No envía fotos, blobs,
EXIF, data URLs, nombres de archivo privados, nombres de personas, emails,
teléfonos, direcciones, contraseñas, tokens ni respuestas de proveedores.

Conserva tipos de excepción permitidos, frames (línea/columna/función de código),
cadenas de excepciones, y sólo rutas `/assets/*.js|mjs` sin query/host como filename.
Otras rutas de frames se omiten para no filtrar rutas locales o URLs privadas.
Los valores textuales de las excepciones se sustituyen por un texto fijo incluso
si parecen inocuos: no se puede sanear una dirección/nombre arbitrario con garantías
mediante regex. Esto reduce detalle textual; se diagnostica por etapa, código y
frames. Conserva release/environment configurados y metadata básica del evento.
Los fingerprints usan grouping predeterminado + operación + etapa + código/status;
no contienen IDs ni texto privado. Los eventos globales no se etiquetan como una
operación de locaciones.

## Cobertura

- Crear/editar: validación técnica inesperada (no validación normal), payload,
  dueño inline, slug, fila principal, features, tags, activity log.
- Alta rápida de dueño/categoría/zona: error técnico y activity log absorbido cuando
  se invoca desde LocationForm con correlation ID.
- Preparación local, conversión HEIC, detección de rostros y blur automático:
  etapas propagadas hasta el catch por archivo. No reporta placeholders eliminados
  ni resultados de preparación descartados por desmontaje.
- Upload URL, POST Cloudflare, finalización metadata, delete, fuente y replace.
  MIME/bytes/dimensiones/índice y cantidad se añaden en el lote de guardado.
- Blur manual y refresco posterior. Cada acción usa su propia correlación.
- Opciones, detalle de edición/consulta, listado y carga/refresco de galería.
  Los efectos conservan sus guards de desmontaje, antes del reporter.
- Delete desde listado, detalle, categoría y dueño, con correlación por operación.
  Se conserva el comportamiento actual de cada caller.
- Análisis opcional de LocationForm: preparación de entrada y fallo del provider.

DB principal confirmada + etapa posterior fallida => partial, con ID y etapas
confirmadas. Un timeout/error de red de escritura puede tener resultado unknown:
no se afirma rollback ni ausencia de escritura. La correlación es frontend; aún no
hay correlación del servidor ni checkpoints durables.

`location-edge-errors.ts` puede reconocer algunos pasos de delete a partir de
mensajes exactos y constantes del contrato actual de Edge, leyendo una copia de
la respuesta sin cambiar el mensaje de UI. “Could not delete location.” y “Could
not delete image metadata.” implican que Cloudflare ya fue borrado: db_delete y
partial. Otros fallos de cleanup son unknown porque no hay contador de borrados.
Un error genérico/no JSON/desconexión no permite inferir la etapa interna.

## Límites y Fase 2

No hay SDK/DSN separado de Sentry servidor configurado en este repo. Se difiere la
instrumentación interna de location-image-upload-url, location-image-finalize,
location-image-delete, location-image-replace, location-image-detect-sensitive-content
y location-delete. No se reutiliza el DSN frontend. Los errores de estas funciones
que recibe el navegador están cubiertos; fallos absorbidos por el servidor (por
ejemplo cleanup posterior a un replace exitoso) todavía no generan evento.

Quedan pendientes captura interna del servidor, checkpoints estructurados (en lugar
de reconocer mensajes de delete), correlación frontend/Edge, source maps y prueba
de recepción real. También errores de Dropbox/Maps, componentes de imágenes sin
consumidores activos y otros módulos fuera del alcance principal de esta fase.

No se corrigen: falta de drafts, pérdidas al recargar/navegar, operaciones no
atómicas, assets huérfanos, idempotencia, reintentos, cleanup/reconciliación ni el
bug de “Locación eliminada” tras un fallo absorbido por useLocations. Tampoco la
navegación al fallar uploads al crear ni el guardado con preparación fallida.
Observabilidad no equivale a recuperación de datos.

## Pruebas y comandos

`node --experimental-vm-modules --test tests/observability/reporting.test.mjs`

Usa node:test, TypeScript ya instalado y VM Modules. Mockea Supabase y Sentry. El
harness carga servicios reales; obtiene los handlers anidados de LocationForm con
el AST de TypeScript y los ejecuta con las dependencias UI simuladas, sin copiar
su implementación. Incluye una prueba adicional del SDK real con transporte
simulado para verificar el evento final después de beforeSend. No usa credenciales,
API real ni manda envelopes a Sentry. No es una prueba E2E de navegador.

Validar además: `npx tsc -b`, `npm run lint`, `npm run build`, `git diff --check`.
El lint del checkout anterior ya tenía 21 errores/2 warnings en archivos tracked,
y 1 error en el fixture E2E no tracked preexistente; esta fase no los corrige ni
cambia las reglas para ocultarlos.

La revisión final agrega nueve regresiones (29 pruebas en total): las seis cargas
de opciones conservan el error Supabase en cause con code/status; las altas inline
de dueño/categoría conservan la causa y el mensaje amigable; el scope excluye IDs
de personas incluso antes de beforeSend. Los servicios siguen sin reportar errores
que propagan al caller.

## Archivos de esta fase

- Base: `.env.example`, `src/main.tsx`, `src/lib/admin-error-reporting.ts`.
- Locaciones: `LocationForm.tsx`, `LocationEditPage.tsx`, `LocationViewPage.tsx`,
  `LocationsPage.tsx`, `useLocations.ts`, `useLocationImages.ts`,
  `locations.service.ts`, `location-images.service.ts`,
  `location-sensitive-content.service.ts`, `location-image-selection.ts`,
  `location-edge-errors.ts` (todos en `src/features/locations`).
- Auxiliares: `src/features/activity/activity-logs.service.ts`,
  `src/features/owners/owners.service.ts`, `src/features/owners/OwnerEditPage.tsx`,
  `src/features/categories/categories.service.ts`,
  `src/features/categories/CategoriesPage.tsx`, `src/features/zones/zones.service.ts`,
  `src/features/images/image-upload.constants.ts`,
  `src/features/images/image-upload.processor.ts`,
  `src/features/location-analysis/providers/openai.provider.ts`.
- Pruebas/documentación: `tests/observability/harness.mjs`,
  `tests/observability/reporting.test.mjs`, `docs/observability-phase-1.md`.

El workspace ya contenía la mayor parte de esta instrumentación al comenzar la
revisión, además de cambios de configuración Playwright y archivos E2E. Esos
cambios preexistentes se conservaron; no se instalaron dependencias en esta revisión.

## Resultado de verificación (2026-09-07)

- `npx tsc -b`: correcto.
- `npm run build`: correcto; Vite advierte chunks mayores a 500 kB.
- `node --experimental-vm-modules --test tests/observability/reporting.test.mjs`:
  29/29 correctas, sin enviar eventos a Sentry.
- Lint completo: 22 errores y 2 warnings. Comparación ejecutada con ESLint sobre
  el contenido de HEAD de los archivos tracked de src/supabase: 21 errores y
  2 warnings preexistentes; el error restante está en el fixture E2E preexistente
  `tests/e2e/admin/support/test.ts`. Se corrigieron los dos imports sin uso de la
  implementación incompleta; no se desactivaron reglas.
- `git diff --check`: correcto. Sin cambios en `supabase/` y sin despliegue.
