import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import {
  formatProposalDateTime,
  getProposalDescription,
  getProposalLocationLabel,
  getProposalSummaryTitle,
} from './proposal-submissions.helpers'
import { useProposalSubmissionDetail } from './useProposalSubmissionDetail'
import {
  PROPOSAL_STATUS_OPTIONS,
  type ProposalDetails,
  type ProposalStatus,
} from './proposal-submissions.types'

function FieldLabel({
  children,
  htmlFor,
}: {
  children: string
  htmlFor: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldValueClassName() {
  return 'text-sm leading-6 text-slate-700'
}

function ReadOnlyField({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  const normalizedValue =
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : null

  return (
    <div>
      <p className="mb-2 block text-sm font-medium text-slate-700">{label}</p>
      {normalizedValue !== null ? (
        <input
          readOnly
          value={normalizedValue}
          className={[inputClassName(), 'font-medium'].join(' ')}
        />
      ) : (
        <div className={fieldValueClassName()}>{children}</div>
      )}
    </div>
  )
}

function ProposalManagementCard({
  isSaving,
  proposal,
  onSave,
}: {
  isSaving: boolean
  proposal: ProposalDetails
  onSave: (status: ProposalStatus, adminNotes: string) => Promise<void>
}) {
  return (
    <div className="w-full sm:max-w-xs">
        <FieldLabel htmlFor="proposal-status">Estado interno</FieldLabel>
        <select
          id="proposal-status"
          value={proposal.status}
          onChange={(event) =>
            void onSave(
              event.target.value as ProposalStatus,
              proposal.adminNotes ?? '',
            )
          }
          disabled={isSaving}
          className={inputClassName()}
        >
          {PROPOSAL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
    </div>
  )
}

function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    proposal,
    isLoading,
    isSaving,
    errorMessage,
    saveErrorMessage,
    saveSuccessMessage,
    reload,
    save,
  } = useProposalSubmissionDetail(id)

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Propuestas', to: routePaths.proposals },
        { label: proposal ? getProposalSummaryTitle(proposal) : 'Detalle' },
      ],
      title: proposal ? getProposalSummaryTitle(proposal) : 'Detalle de propuesta',
      description:
        'Revisá la información enviada desde la web pública, consultá la galería y actualizá el estado interno.',
    }),
    [proposal],
  )

  useLayoutHeader(headerConfig)

  const isNotFound = errorMessage === 'PROPOSAL_NOT_FOUND'

  return (
    <PageContainer
      title="Detalle de propuesta"
      description="Revisá la información enviada desde la web pública, consultá la galería y actualizá el estado interno."
      hideHeader
    >
      {isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando propuesta...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {isNotFound
                  ? 'No encontramos la propuesta'
                  : 'No pudimos cargar la propuesta'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isNotFound
                  ? 'La propuesta que intentaste abrir no existe o ya no está disponible.'
                  : errorMessage}
              </p>
            </div>
            {!isNotFound ? (
              <Button variant="secondary" onClick={() => void reload()}>
                Reintentar
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && proposal ? (
        <>
          {saveErrorMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No pudimos guardar los cambios
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {saveErrorMessage}
                </p>
              </div>
            </Card>
          ) : null}

          {saveSuccessMessage ? (
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Propuesta actualizada
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {saveSuccessMessage}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="space-y-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Datos de la propuesta
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {formatProposalDateTime(proposal.createdAt)}
                  </p>
                </div>

                <ProposalManagementCard
                  key={`${proposal.id}:${proposal.updatedAt ?? proposal.status}:${proposal.adminNotes ?? ''}`}
                  proposal={proposal}
                  isSaving={isSaving}
                  onSave={save}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <ReadOnlyField label="Nombre">
                  {proposal.ownerName}
                </ReadOnlyField>
                <ReadOnlyField label="Email">
                  {proposal.ownerEmail}
                </ReadOnlyField>
                <ReadOnlyField label="Teléfono">
                  {proposal.ownerPhone}
                </ReadOnlyField>
                <ReadOnlyField label="Ubicación">
                  {getProposalLocationLabel(proposal)}
                </ReadOnlyField>
              </div>

              <div className="space-y-6 border-t border-slate-200 pt-6">
                <div>
                  <div className="rounded-2xl border border-slate-300 bg-white px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {getProposalDescription(proposal)}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </Card>

          <Card>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Galería</h3>
              </div>

              {proposal.images.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                  Esta propuesta no tiene imágenes cargadas.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {proposal.images.map((image, index) => (
                    <article
                      key={image.id}
                      className="overflow-hidden border border-dashed border-slate-300 bg-slate-50"
                    >
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <img
                          src={image.imageUrl}
                          alt={`Imagen ${index + 1} de la propuesta ${getProposalSummaryTitle(proposal)}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}

export default ProposalDetailPage
