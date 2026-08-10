import { useNavigate } from 'react-router-dom'
import { getSettingsConnectionDetailPath } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import type { SettingsConnectionItem } from './settings.types'
import {
  getIntegrationBillingCycleLabel,
  getIntegrationStatusLabel,
} from './settings.types'

type SettingsConnectionsTableProps = {
  connections: SettingsConnectionItem[]
}

function getIntegrationStatusBadgeClassName(status: SettingsConnectionItem['status']) {
  if (status === 'connected') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'configured' || status === 'active') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (status === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function SettingsConnectionsTable({ connections }: SettingsConnectionsTableProps) {
  const navigate = useNavigate()

  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Conexiones</h2>
          <p className="mt-1 text-sm text-slate-600">
            {connections.length} {connections.length === 1 ? 'integración visible' : 'integraciones visibles'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Servicio
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Estado
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Facturación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {connections.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No hay conexiones para mostrar.
                </td>
              </tr>
            ) : null}

            {connections.map((connection) => (
              <tr
                key={connection.key}
                className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)]"
                onClick={() => navigate(getSettingsConnectionDetailPath(connection.id))}
              >
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                  {connection.name}
                </td>
                <td className="px-3 py-4 text-sm sm:px-6">
                  <span
                    className={[
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                      getIntegrationStatusBadgeClassName(connection.status),
                    ].join(' ')}
                  >
                    {getIntegrationStatusLabel(connection.status)}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm leading-6 text-slate-600 sm:px-6">
                  {getIntegrationBillingCycleLabel(connection.billingCycle)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default SettingsConnectionsTable
