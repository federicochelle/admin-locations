import type { LocationAnalysisResult } from '../../../location-analysis/location-analysis.types'
import Button from '../../../../components/ui/Button'

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
  if (isReadOnly) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={isDisabled || analysisLoading}
          onClick={onAnalyze}
        >
          {analysisLoading ? 'Analizando...' : '✨ Analizar con IA'}
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

          <div className="space-y-1">
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

          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-950">Tags sugeridos</p>
            {suggestedTagNames.length > 0 ? (
              <div className="space-y-1.5">
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
