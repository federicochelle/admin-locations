import { useMemo, useState } from 'react'
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
  type ProposalStatusFilter,
  type ProposalStatus,
} from './proposal-submissions.types'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldLabelClassName() {
  return 'mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'
}

function getProposalStatusSelectClassName(status: ProposalStatusFilter) {
  switch (status) {
    case 'pending':
      return '!border-amber-300 !bg-amber-100 !text-amber-800 focus:!border-amber-400 focus:!ring-amber-200'
    case 'approved':
      return '!border-emerald-300 !bg-emerald-100 !text-emerald-800 focus:!border-emerald-400 focus:!ring-emerald-200'
    case 'rejected':
      return '!border-slate-300 !bg-slate-100 !text-slate-800 focus:!border-slate-400 focus:!ring-slate-200'
  }
}

function formatOptionalField(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'
}

function toProposalStatusFilter(status: ProposalStatus): ProposalStatusFilter {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    default:
      return 'pending'
  }
}

function fromProposalStatusFilter(status: ProposalStatusFilter): ProposalStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'pending':
      return 'pending'
  }
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="min-w-0">
      <p className={fieldLabelClassName()}>{label}</p>
      <p className="text-sm font-medium leading-6 text-slate-900">
        {formatOptionalField(value)}
      </p>
    </div>
  )
}

function getProposalImageSrc(proposalImage: ProposalDetails['images'][number]) {
  return proposalImage.isStorageImage
    ? proposalImage.signedUrl
    : proposalImage.imageUrl
}

function ProposalManagementCard({
  isSaving,
  proposal,
  onSave,
}: {
  isSaving: boolean
  proposal: ProposalDetails
  onSave: (status: ProposalStatus) => Promise<void>
}) {
  const [status, setStatus] = useState<ProposalStatusFilter>(
    toProposalStatusFilter(proposal.status),
  )

  return (
    <div className="w-full min-w-0 sm:max-w-sm">
      <div className="flex items-center gap-3">
        <select
          id="proposal-status"
          value={status}
          onChange={(event) => {
            const nextStatus = event.target.value as ProposalStatusFilter
            setStatus(nextStatus)
            void onSave(fromProposalStatusFilter(nextStatus))
          }}
          disabled={isSaving}
          className={[
            inputClassName(),
            getProposalStatusSelectClassName(status),
            'flex-1 font-semibold',
          ].join(' ')}
        >
          {PROPOSAL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
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

          <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x">
            <div className="space-y-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                      Datos de la propuesta
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                      {formatProposalDateTime(proposal.submittedAt)}
                    </p>
                  </div>
                </div>

                <ProposalManagementCard
                  key={`${proposal.id}:${proposal.updatedAt ?? proposal.status}:${proposal.adminNotes ?? ''}`}
                  proposal={proposal}
                  isSaving={isSaving}
                  onSave={save}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="space-y-6">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                    <ReadOnlyField label="Nombre" value={proposal.ownerName} />
                    <ReadOnlyField label="Email" value={proposal.ownerEmail} />
                    <ReadOnlyField label="Teléfono" value={proposal.ownerPhone} />
                    <ReadOnlyField
                      label="Ubicación"
                      value={getProposalLocationLabel(proposal)}
                    />
                  </div>

                  <div>
                    <p className={fieldLabelClassName()}>Descripción</p>
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
                {proposal.imageReadUrlsError ? (
                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    {proposal.imageReadUrlsError}
                  </p>
                ) : null}
              </div>

              {proposal.images.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                  Esta propuesta no tiene imágenes cargadas.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {proposal.images.map((image, index) => {
                    const imageSrc = getProposalImageSrc(image)

                    return (
                      <article
                        key={image.id}
                        className="overflow-hidden border border-dashed border-slate-300 bg-slate-50"
                      >
                        <div className="relative aspect-[16/10] bg-slate-100">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={`Imagen ${index + 1} de la propuesta ${getProposalSummaryTitle(proposal)}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-600">
                              No pudimos cargar esta imagen por ahora.
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
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
