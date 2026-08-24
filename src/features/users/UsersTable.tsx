import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserDetailPath } from '../../app/router/route-paths'
import Card from '../../components/ui/Card'
import type { UserListItem } from './users.types'
import {
  getUserRoleLabel,
  getUserRoleKey,
} from './users.types'

type UsersTableProps = {
  headerCenter?: ReactNode
  users: UserListItem[]
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatCellValue(value: string | null) {
  const hasValue = value && value.trim().length > 0

  return (
    <span className={hasValue ? 'text-slate-900' : 'text-slate-500'}>
      {hasValue ? value : '-'}
    </span>
  )
}

function getRoleBadgeClassName(role: string | null) {
  return getUserRoleKey(role) === 'admin'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-slate-200 bg-slate-100 text-slate-700'
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UsersTable({ headerCenter, users }: UsersTableProps) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchTerm.trim())

    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [user.fullName ?? '', user.email ?? '', user.companyName ?? ''].some((field) =>
          normalizeSearchValue(field).includes(normalizedSearch),
        )

      return matchesSearch
    })
  }, [searchTerm, users])

  function handleRowClick(profileId: string) {
    navigate(getUserDetailPath(profileId))
  }

  function handleRowKeyDown(
    profileId: string,
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    navigate(getUserDetailPath(profileId))
  }

  return (
    <Card className="-mx-6 overflow-hidden rounded-none border-x-0 p-0 sm:mx-0 sm:rounded-2xl sm:border-x sm:border-y">
      <div className="border-b border-slate-200 px-3 py-5 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Listado de usuarios</h2>
            <p className="mt-1 text-sm text-slate-600">
              {users.length} {users.length === 1 ? 'usuario registrado' : 'usuarios registrados'}
            </p>
          </div>

          {headerCenter ? (
            <div className="flex items-center justify-start lg:justify-center">
              {headerCenter}
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <label className="relative block min-w-0 lg:w-80">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Buscar nombre, email o empresa"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/95 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-[#f3f2ee]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Usuario
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Email
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Teléfono
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Empresa
              </th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-black sm:px-6">
                Rol
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-transparent">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-sm text-slate-500 sm:px-6">
                  No se encontraron usuarios con los filtros actuales.
                </td>
              </tr>
            ) : null}

            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                tabIndex={0}
                className="cursor-pointer align-top transition hover:bg-[rgba(184,146,74,0.10)] focus-visible:bg-[rgba(184,146,74,0.10)] focus-visible:outline-none"
                onClick={() => handleRowClick(user.profileId)}
                onKeyDown={(event) => handleRowKeyDown(user.profileId, event)}
              >
                <td className="px-3 py-4 text-sm font-medium text-slate-950 sm:px-6">
                  {user.fullName?.trim() || 'Sin nombre'}
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  {formatCellValue(user.email)}
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  {formatCellValue(user.phone)}
                </td>
                <td className="px-3 py-4 text-sm text-slate-900 sm:px-6">
                  {formatCellValue(user.companyName)}
                </td>
                <td className="px-3 py-4 text-sm sm:px-6">
                  <span
                    className={[
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                      getRoleBadgeClassName(user.role),
                    ].join(' ')}
                  >
                    {getUserRoleLabel(user.role)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default UsersTable
