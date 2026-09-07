# Session Replay del admin

Compatible con `@sentry/react@10.73.0` ya instalado; no añade dependencias.
`src/main.tsx` añade `replayIntegration` sólo cuando Sentry está habilitado
(`PROD` y DSN presente). Muestreo normal `0`, por error `1.0`. Conserva
`sendDefaultPii: false`, release, entorno y handlers React. No activa tracing.

`src/lib/admin-session-replay.ts` enmascara todo texto/input, bloquea formularios,
controles, diálogos, canvas, iframes y media. Descarta breadcrumbs de Replay
(consola, red, navegación y selectores); no captura cuerpos ni headers de red.
No permite excepciones de unmask/unblock.

Replay no pasa por `beforeSend`. Además, `beforeAddRecordingEvent` no cubre los
snapshots rrweb ni su URL inicial. Por eso un filtro final del transporte elimina
URLs, datos del usuario, atributos, CSS y texto de las grabaciones, conservando
estructura, coordenadas, dimensiones e IDs técnicos. Los frames de mutaciones
conservan su estructura. Se deshabilita compresión para inspeccionar el formato
soportado por esta versión. Ante un formato desconocido se descarta el envelope
de Replay completo; el transporte de errores sigue funcionando.

El resultado tiene menor fidelidad visual: no muestra estilos, contenido privado
ni detalles de formularios. No es una copia visual exacta del admin. Los segmentos
sin comprimir son mayores; sólo se envían tras un error seleccionado. En modo
buffer el SDK mantiene una grabación temporal previa al error, aun con muestreo
normal `0`; después del error continúa la grabación según los límites del SDK.

`src/lib/admin-error-reporting.ts` conserva `tags.replayId` únicamente cuando es
un ID hexadecimal de 32 caracteres. La integración lo añade antes de `beforeSend`.
Esto permite el muestreo por error y el vínculo tanto para `reportAdminError` como
para errores globales/React. No agrega etiquetas de locaciones a errores globales.
Los mensajes sin excepción no disparan por sí solos el buffer de Replay.

## Verificación local

- `npm run build` ejecuta TypeScript y Vite.
- `node --experimental-vm-modules --test tests/observability/reporting.test.mjs tests/observability/replay.test.mjs tests/version-recovery/recovery.test.mjs`
- `node --test tests/observability/replay-browser.test.mjs` usa Chromium y el SDK
  real, con transporte en memoria y tráfico externo bloqueado. Si Chromium está
  en una ubicación alternativa, definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

La prueba del navegador abre una página sintética independiente; no usa datos,
credenciales ni APIs reales del admin. Verifica errores manejados/globales, IDs
en ambos sentidos, ausencia de tracing, snapshots y ausencia de valores privados
en los envelopes finales. La recepción y reproducción en Sentry se verifica
manualmente; esta prueba no envía datos a Sentry.

Verificación de esta implementación: 32 pruebas de observabilidad/privacidad y
la prueba de navegador correctas; TypeScript/build y lint de los archivos tocados
correctos. Vite advierte sobre chunks mayores a 500 kB. La suite de recovery tiene
3 fallos reproducidos también en el baseline limpio `8ade66d`: su fixture usa el
mismo string `reload` para telemetría y para invocar la recarga. Se conserva sin
modificaciones, al igual que package.json y package-lock.json.

## Error controlado en LocationForm y comprobación del issue

1. Usar un build de producción con `VITE_SENTRY_DSN` configurado, servido con
   `npm run preview`, o un entorno de prueba ya autorizado. `npm run dev` mantiene
   Sentry deshabilitado. No se requiere publicar para probar con preview local.
2. En Chrome DevTools, Network → Request blocking, bloquear temporalmente
   `*/rest/v1/categories*`. Abrir `/locations/new` desde el admin. La carga de
   opciones es una lectura: falla dentro de LocationForm y reporta
   `operation=location.options`, `stage=options`. No guardar ni enviar el formulario.
3. Esperar al envío de Sentry. En Network, los envelopes deben incluir el error
   con `tags.replayId` y los elementos `replay_event`/`replay_recording`. Comprobar
   que `replay_id` coincide y que `error_ids` contiene el ID del error.
4. En Sentry → Issues, filtrar por `operation:location.options`, abrir el evento
   reciente y su sección Replay/Related Replay. Reproducir y confirmar que no se
   ven textos privados, formularios ni media. El procesamiento puede demorar;
   comprobar también bloqueadores, cuota de Replay y errores de ingestión.
5. Quitar el bloqueo de requests. Para comprobar un error global independiente,
   ejecutar `setTimeout(() => { throw new Error('Replay smoke test') }, 0)` en
   DevTools y revisar su evento/Replay de la misma forma.

Referencias: [configuración](https://docs.sentry.io/platforms/javascript/session-replay/configuration/)
y [privacidad](https://docs.sentry.io/platforms/javascript/session-replay/privacy/).
La implementación y los tests verifican además el código de la versión instalada.
