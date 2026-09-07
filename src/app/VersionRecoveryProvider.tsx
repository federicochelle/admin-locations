import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { unsavedRegistry } from '../lib/unsaved-critical-state'
import { versionRecovery } from '../lib/version-recovery'

export default function VersionRecoveryProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(versionRecovery.subscribe, versionRecovery.getSnapshot)
  const dirty = useSyncExternalStore(unsavedRegistry.subscribe, unsavedRegistry.hasUnsavedCriticalState)
  const blocker = useBlocker(() => unsavedRegistry.hasUnsavedCriticalState())
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!versionRecovery.isNavigating() && unsavedRegistry.hasUnsavedCriticalState()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const focus = () => { void versionRecovery.check('focus') }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('focus', focus)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('focus', focus)
    }
  }, [])
  function update() {
    if (unsavedRegistry.hasUnsavedCriticalState() && !window.confirm('Al actualizar perderás los cambios no guardados y se interrumpirán las operaciones en curso. ¿Querés continuar?')) return
    versionRecovery.manualReload()
  }
  return <>
    {state.kind !== 'idle' && <div role="status" className="sticky top-0 z-[100] flex flex-wrap items-center gap-3 bg-amber-100 p-4 text-sm text-amber-950">
      <span>{state.kind === 'manual'
        ? 'No pudimos cargar esta parte de la aplicación. Actualizá la página para continuar.'
        : state.kind === 'reloading' ? 'Actualizando la aplicación…'
          : dirty ? 'Hay una nueva versión disponible. Guardá tu trabajo antes de actualizar.' : 'Hay una nueva versión disponible.'}</span>
      {state.kind !== 'reloading' && <button type="button" className="rounded border border-amber-900 px-3 py-2 font-semibold" onClick={update}>Actualizar ahora</button>}
    </div>}
    {blocker.state === 'blocked' && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" className="max-w-md rounded-xl bg-white p-6 text-slate-900">
        <h2 id="unsaved-title" className="text-lg font-semibold">Tenés trabajo sin guardar</h2>
        <p className="my-4">Si salís, perderás los cambios no guardados y se interrumpirán las operaciones en curso.</p>
        <button autoFocus type="button" className="mr-4 rounded border px-3 py-2" onClick={() => blocker.reset()}>Seguir trabajando</button>
        <button type="button" className="rounded border px-3 py-2" onClick={() => blocker.proceed()}>Salir y descartar</button>
      </div>
    </div>}
    {children}
  </>
}
