import { useEffect, useState } from 'react'
import type { LocationAnalysisResult } from '../../../location-analysis/location-analysis.types'
import Button from '../../../../components/ui/Button'

type AnalysisStatusIconName =
  | 'analysis'
  | 'images'
  | 'location'
  | 'materials'
  | 'spaces'
  | 'style'
  | 'description'
  | 'tags'
  | 'success'

const ANALYSIS_LOADING_MESSAGES = [
  { icon: 'images', text: 'Analizando imágenes...' },
  { icon: 'analysis', text: 'Interpretando la locación...' },
  { icon: 'location', text: 'Analizando ubicación...' },
  { icon: 'materials', text: 'Detectando materiales...' },
  { icon: 'spaces', text: 'Identificando espacios...' },
  { icon: 'style', text: 'Reconociendo estilo visual...' },
  { icon: 'description', text: 'Generando descripción...' },
  { icon: 'tags', text: 'Seleccionando tags...' },
  { icon: 'success', text: 'Preparando resultados...' },
] as const

const ANALYSIS_LOADING_MESSAGE_INTERVAL_MS = 2500

type LocationAnalysisPanelProps = {
  analysisError: string | null
  analysisLoading: boolean
  analysisResult: LocationAnalysisResult | null
  suggestedFeatureNames: string[]
  suggestedTagNames: string[]
  isDisabled: boolean
  isReadOnly: boolean
  onApplyChanges: () => void
  onAnalyze: () => void
  onDiscard: () => void
}

function AnalysisStatusIcon({
  className = 'h-4 w-4',
  name,
}: {
  className?: string
  name: AnalysisStatusIconName
}) {
  switch (name) {
    case 'images':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1.6" fill="currentColor" />
          <path d="M6.5 16l3.4-3.4a1 1 0 0 1 1.4 0L14 15.3l1.6-1.6a1 1 0 0 1 1.4 0l1.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'location':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 20s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.2" fill="currentColor" />
        </svg>
      )
    case 'materials':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 8.5h16M4 15.5h16M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'spaces':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 19V8.8a1 1 0 0 1 .42-.81l7-5a1 1 0 0 1 1.16 0l7 5A1 1 0 0 1 20 8.8V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 19v-4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'style':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 4c4.4 0 8 2.9 8 6.5 0 2.9-2.3 5.4-5.5 6.2-.6.2-1 .7-1 1.3v.5c0 .6-.4 1-1 1A8.5 8.5 0 0 1 12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
          <circle cx="11.5" cy="8.5" r="1" fill="currentColor" />
          <circle cx="15" cy="9.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="13" r="1" fill="currentColor" />
        </svg>
      )
    case 'description':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M7 5.5h10M7 9.5h10M7 13.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'tags':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="m12.5 4.5 6.5 6.5-7 7a2.1 2.1 0 0 1-3 0L4.5 13.5v-9h8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" />
        </svg>
      )
    case 'success':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8.5 12.5 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'analysis':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="m4.5 19.5 8.8-8.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m12.7 6.3 1-2.8 1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16.8 12.2v2.2M15.7 13.3H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="6.6" cy="17.4" r="1.6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
  }
}

function LocationAnalysisPanel({
  analysisError,
  analysisLoading,
  analysisResult,
  suggestedFeatureNames,
  suggestedTagNames,
  isDisabled,
  isReadOnly,
  onApplyChanges,
  onAnalyze,
  onDiscard,
}: LocationAnalysisPanelProps) {
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  useEffect(() => {
    if (!analysisLoading) {
      setLoadingMessageIndex(0)
      return
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((currentIndex) =>
        (currentIndex + 1) % ANALYSIS_LOADING_MESSAGES.length,
      )
    }, ANALYSIS_LOADING_MESSAGE_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [analysisLoading])

  if (isReadOnly) {
    return null
  }

  const currentLoadingMessage = ANALYSIS_LOADING_MESSAGES[loadingMessageIndex]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={isDisabled || analysisLoading}
          onClick={onAnalyze}
        >
          <span className="inline-flex items-center gap-2">
            <AnalysisStatusIcon
              name={analysisLoading ? currentLoadingMessage.icon : 'analysis'}
            />
            <span>
              {analysisLoading
                ? currentLoadingMessage.text
                : 'Analizar con IA'}
            </span>
          </span>
        </Button>
      </div>

      {analysisError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {analysisError}
        </div>
      ) : null}

      {analysisResult ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_rgba(248,248,246,0.96)_0%,_rgba(255,255,255,0.98)_100%)] p-4">
          <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-950">
            Propuesta IA
          </h5>

          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-950">Descripción sugerida</p>
            <p className="text-sm leading-6 text-slate-600">
              {analysisResult.description || '-'}
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-4">
            <div className="space-y-1 xl:col-span-1">
              <p className="text-sm font-medium text-slate-950">Features sugeridas</p>
              {suggestedFeatureNames.length > 0 ? (
                <div className="space-y-1.5">
                  {suggestedFeatureNames.map((featureName) => (
                    <p key={featureName} className="text-sm leading-6 text-slate-600">
                      {`✓ ${featureName}`}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-600">-</p>
              )}
            </div>

            <div className="space-y-1 xl:col-span-3">
              <p className="text-sm font-medium text-slate-950">Tags sugeridos</p>
              {suggestedTagNames.length > 0 ? (
                <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {suggestedTagNames.map((tagName) => (
                    <p key={tagName} className="text-sm leading-6 text-slate-600">
                      {`✓ ${tagName}`}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-600">-</p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onDiscard}
              disabled={isDisabled || analysisLoading}
            >
              Descartar
            </Button>
            <Button
              type="button"
              onClick={onApplyChanges}
              disabled={isDisabled || analysisLoading}
            >
              Aplicar cambios
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default LocationAnalysisPanel
