import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { routePaths } from '../../app/router/route-paths'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageContainer from '../../components/ui/PageContainer'
import { buttonBaseClassName, buttonVariantClasses } from '../../components/ui/button.styles'
import ProposalStatusBadge from './ProposalStatusBadge'
import {
  formatOptionalField,
  formatProposalDateTime,
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

function ProposalManagementCard({
  isSaving,
  proposal,
  onSave,
}: {
  isSaving: boolean
  proposal: ProposalDetails
  onSave: (status: ProposalStatus, adminNotes: string) => Promise<void>
}) {
  const [draftStatus, setDraftStatus] = useState<ProposalStatus>(proposal.status)
  const [draftAdminNotes, setDraftAdminNotes] = useState(proposal.adminNotes ?? '')

  const hasPendingChanges =
    draftStatus !== proposal.status ||
    draftAdminNotes.trim() !== (proposal.adminNotes ?? '').trim()

  return (
    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <FieldLabel htmlFor="proposal-status">Estado interno</FieldLabel>
        <select
          id="proposal-status"
          value={draftStatus}
          onChange={(event) =>
            setDraftStatus(event.target.value as ProposalStatus)
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

      <div>
        <FieldLabel htmlFor="proposal-admin-notes">Notas internas</FieldLabel>
        <textarea
          id="proposal-admin-notes"
          rows={5}
          value={draftAdminNotes}
          onChange={(event) => setDraftAdminNotes(event.target.value)}
          disabled={isSaving}
          className={inputClassName()}
          placeholder="Agregá notas internas para seguimiento, coordinación o decisión."
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => void onSave(draftStatus, draftAdminNotes)}
          disabled={!hasPendingChanges || isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
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
    saveSuccessMessage,
    reload,
    save,
  } = useProposalSubmissionDetail(id)

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [
        { label: 'Panel admin', to: routePaths.dashboard },
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
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={routePaths.proposals}
          className={[buttonBaseClassName, buttonVariantClasses.secondary].join(' ')}
        >
          Volver a propuestas
        </Link>
        {!isLoading && !errorMessage ? (
          <button
            type="button"
            onClick={() => void reload()}
            className="text-sm font-medium text-slate-300 hover:text-white"
          >
            Actualizar vista
          </button>
        ) : null}
      </div>

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
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ProposalStatusBadge status={proposal.status} />
                  <p className="text-sm text-slate-500">
                    Recibida el {formatProposalDateTime(proposal.createdAt)}
                  </p>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {proposal.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatOptionalField(proposal.department)}
                    {' · '}
                    {formatOptionalField(proposal.zone)}
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
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Datos del propietario
                  </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="proposal-owner-name">Nombre</FieldLabel>
                    <input
                      id="proposal-owner-name"
                      readOnly
                      value={proposal.ownerName}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="proposal-owner-phone">Teléfono</FieldLabel>
                    <input
                      id="proposal-owner-phone"
                      readOnly
                      value={proposal.ownerPhone}
                      className={inputClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="proposal-owner-email">Email</FieldLabel>
                    <input
                      id="proposal-owner-email"
                      readOnly
                      value={proposal.ownerEmail}
                      className={inputClassName()}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Datos de la locación propuesta
                  </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="proposal-title">Título</FieldLabel>
                    <input
                      id="proposal-title"
                      readOnly
                      value={proposal.title}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="proposal-department">Departamento</FieldLabel>
                    <input
                      id="proposal-department"
                      readOnly
                      value={formatOptionalField(proposal.department)}
                      className={inputClassName()}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="proposal-zone">Zona</FieldLabel>
                    <input
                      id="proposal-zone"
                      readOnly
                      value={formatOptionalField(proposal.zone)}
                      className={inputClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="proposal-address">Dirección</FieldLabel>
                    <input
                      id="proposal-address"
                      readOnly
                      value={formatOptionalField(proposal.address)}
                      className={inputClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="proposal-location-type">Tipo de locación</FieldLabel>
                    <input
                      id="proposal-location-type"
                      readOnly
                      value={formatOptionalField(proposal.locationType)}
                      className={inputClassName()}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Descripción y mensaje
                </h3>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="proposal-description">Descripción</FieldLabel>
                  <textarea
                    id="proposal-description"
                    readOnly
                    rows={6}
                    value={proposal.description ?? '-'}
                    className={inputClassName()}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="proposal-message">Mensaje</FieldLabel>
                  <textarea
                    id="proposal-message"
                    readOnly
                    rows={6}
                    value={proposal.message ?? '-'}
                    className={inputClassName()}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Galería</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {proposal.images.length} imágenes asociadas a esta propuesta
                  </p>
                </div>
                {proposal.updatedAt ? (
                  <p className="text-sm text-slate-500">
                    Última actualización: {formatProposalDateTime(proposal.updatedAt)}
                  </p>
                ) : null}
              </div>

              {proposal.images.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                  Esta propuesta no tiene imágenes cargadas.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {proposal.images.map((image, index) => (
                    <figure
                      key={image.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={image.imageUrl}
                        alt={`Imagen ${index + 1} de la propuesta ${proposal.title}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <figcaption className="space-y-1 px-4 py-3 text-xs text-slate-500">
                        <p>Orden: {image.sortOrder ?? index + 1}</p>
                        <p>Subida: {formatProposalDateTime(image.createdAt)}</p>
                      </figcaption>
                    </figure>
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
