import { getLocationDetailPath } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { getOwnerWhatsappDigits } from '../../lib/phone'
import type { AdminRequestLocation } from './admin-location-requests.types'

type RequestIncludedLocationsTableProps = {
  locations: AdminRequestLocation[]
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}

function formatCellValue(value: string | null) {
  const hasValue = value && value.trim().length > 0

  return (
    <span className={hasValue ? 'text-slate-900' : 'text-slate-500'}>
      {hasValue ? value : '-'}
    </span>
  )
}

function getFormattedLocationCode(locationCode: string | null) {
  const normalizedCode = locationCode?.trim()

  return normalizedCode ? normalizedCode.replaceAll('-', ' ') : null
}

function formatDisplayDate(value: string | null) {
  if (!value) {
    return 'A confirmar'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate)
}

function buildSelectionMessage(input: {
  ownerName: string | null
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const ownerName = input.ownerName?.trim() || 'dueno'
  const companyName = input.companyName?.trim() || 'A confirmar'
  const formattedStartDate = formatDisplayDate(input.tentativeStartDate)
  const formattedEndDate = formatDisplayDate(input.tentativeEndDate)

  return [
    `Hola ${ownerName}.`,
    '',
    `Tu locacion "${input.locationTitle}" fue preseleccionada para una produccion audiovisual.`,
    '',
    'Fecha tentativa:',
    `${formattedStartDate} al ${formattedEndDate}`,
    '',
    'Productora:',
    companyName,
    '',
    'Nos estaremos comunicando contigo para confirmar disponibilidad.',
    '',
    'Muchas gracias.',
  ].join('\n')
}

function getWhatsappUrl(input: {
  ownerPhone: string | null
  ownerName: string | null
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const normalizedPhone = getOwnerWhatsappDigits(input.ownerPhone)

  if (!normalizedPhone) {
    return null
  }

  const message = buildSelectionMessage({
    ownerName: input.ownerName,
    locationTitle: input.locationTitle,
    tentativeStartDate: input.tentativeStartDate,
    tentativeEndDate: input.tentativeEndDate,
    companyName: input.companyName,
  })

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

function getMailtoUrl(input: {
  ownerEmail: string | null
  ownerName: string | null
  locationTitle: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  companyName: string | null
}) {
  const ownerEmail = input.ownerEmail?.trim()

  if (!ownerEmail) {
    return null
  }

  const subject = `Preseleccion de locacion - ${input.locationTitle}`
  const body = buildSelectionMessage({
    ownerName: input.ownerName,
    locationTitle: input.locationTitle,
    tentativeStartDate: input.tentativeStartDate,
    tentativeEndDate: input.tentativeEndDate,
    companyName: input.companyName,
  })

  return `mailto:${ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-24 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
  )
}

function WhatsappIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M20 11.5a8 8 0 0 1-11.8 7l-4.2 1 1.1-4A8 8 0 1 1 20 11.5Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.3 8.7c.2-.4.4-.4.6-.4h.5c.1 0 .3 0 .4.4l.5 1.5c.1.2 0 .4-.1.6l-.3.4c-.1.1-.2.3 0 .6.3.6 1 1.5 2.2 2 .4.2.6.1.8 0l.4-.3c.2-.1.3-.2.6-.1l1.4.7c.2.1.3.2.3.4v.5c0 .2-.1.5-.4.6-.5.2-1.1.3-1.7.1-1-.2-2-.8-3-1.7-.8-.7-1.5-1.7-1.9-2.8-.3-.7-.2-1.4-.1-1.8Z"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M4 6h16v12H4z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m4 8 8 6 8-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ActionLink({
  actionLabel,
  href,
  children,
}: {
  actionLabel: string
  href: string | null
  children: React.ReactNode
}) {
  const className =
    'group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition'

  if (!href) {
    return (
      <span
        aria-label={`${actionLabel} no disponible`}
        className={`${className} cursor-not-allowed border-slate-200 text-slate-300 opacity-60`}
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
      aria-label={actionLabel}
      className={`${className} border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
        {actionLabel}
      </span>
    </a>
  )
}

function RequestIncludedLocationsTable({
  locations,
  tentativeStartDate,
  tentativeEndDate,
  companyName,
}: RequestIncludedLocationsTableProps) {
  return (
    <Card className="-mx-4 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Locaciones incluidas
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {locations.length} locaciones asociadas a esta solicitud.
          </p>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            title="No hay locaciones asociadas"
            description="Esta solicitud no tiene locaciones vinculadas para mostrar en la ficha."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#f3f2ee]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Imagen
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Locacion
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Dueno
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Telefono
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Email
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-transparent">
              {locations.map((location) => {
                const formattedLocationCode = getFormattedLocationCode(
                  location.locationCode,
                )
                const whatsappUrl = getWhatsappUrl({
                  ownerPhone: location.ownerPhone,
                  ownerName: location.ownerName,
                  locationTitle: location.title,
                  tentativeStartDate,
                  tentativeEndDate,
                  companyName,
                })
                const mailtoUrl = getMailtoUrl({
                  ownerEmail: location.ownerEmail,
                  ownerName: location.ownerName,
                  locationTitle: location.title,
                  tentativeStartDate,
                  tentativeEndDate,
                  companyName,
                })

                return (
                  <tr
                    key={location.id}
                    className="align-top transition hover:bg-[rgba(184,146,74,0.10)]"
                  >
                    <td className="px-3 py-4 sm:px-6">
                      {location.coverImageUrl ? (
                        <div className="h-14 w-24 overflow-hidden border border-slate-200 bg-slate-100">
                          <img
                            src={location.coverImageUrl}
                            alt={`Portada de ${location.title}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <CoverPlaceholder />
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                      <div className="min-w-[220px]">
                        {formattedLocationCode ? (
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8924A]">
                            {formattedLocationCode}
                          </p>
                        ) : null}
                        <a
                          href={getLocationDetailPath(location.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block font-medium text-slate-950 underline-offset-4 transition hover:underline"
                        >
                          {location.title}
                        </a>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                      {formatCellValue(location.ownerName)}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                      <div className="min-w-[140px] whitespace-nowrap">
                        {formatCellValue(location.ownerPhone)}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                      <div className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {formatCellValue(location.ownerEmail)}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                      <div className="flex flex-nowrap items-center gap-2">
                        <ActionLink actionLabel="WhatsApp" href={whatsappUrl}>
                          <WhatsappIcon />
                        </ActionLink>
                        <ActionLink actionLabel="Email" href={mailtoUrl}>
                          <EmailIcon />
                        </ActionLink>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default RequestIncludedLocationsTable
