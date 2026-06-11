import { routePaths } from '../app/router/route-paths'

export type NavigationIcon = {
  paths: string[]
  circle?: {
    cx: string
    cy: string
    r: string
  }
}

export type NavigationItem = {
  disabled?: boolean
  label: string
  to?: string
  icon?: NavigationIcon
  type?: 'item' | 'divider'
}

export const navigationItems: NavigationItem[] = [
  {
    label: 'Inicio',
    to: routePaths.dashboard,
    icon: {
      paths: ['M4 13h7V4H4zm9 7h7v-9h-7zM4 20h7v-5H4zm9-9h7V4h-7z'],
    },
  },
  {
    label: 'Locaciones',
    to: routePaths.locations,
    icon: {
      paths: ['M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z'],
      circle: { cx: '12', cy: '11', r: '2.5' },
    },
  },
  {
    label: 'Dueños',
    to: routePaths.owners,
    icon: {
      paths: [
        'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
      ],
    },
  },
  {
    label: 'Categorías',
    to: routePaths.categories,
    icon: {
      paths: ['M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01'],
    },
  },
  {
    label: 'divider-catalogs',
    type: 'divider',
  },
  {
    disabled: true,
    label: 'Solicitudes',
    icon: {
      paths: [
        'M8 6h8M8 12h8M8 18h5M5 6h.01M5 12h.01M5 18h.01',
      ],
    },
  },
  {
    disabled: true,
    label: 'Propuestas',
    icon: {
      paths: [
        'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z',
        'm8 9 4 3 4-3',
      ],
    },
  },
  {
    disabled: true,
    label: 'Reservas',
    icon: {
      paths: [
        'M8 3v3M16 3v3M4 9h16M5 6.5h14A1.5 1.5 0 0 1 20.5 8v10A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18V8A1.5 1.5 0 0 1 5 6.5Z',
      ],
    },
  },
  {
    label: 'divider-admin',
    type: 'divider',
  },
  {
    disabled: true,
    label: 'Usuarios',
    icon: {
      paths: [
        'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
        'M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      ],
    },
  },
  {
    disabled: true,
    label: 'Suscripciones',
    icon: {
      paths: [
        'M12 3v18M7 7.5h6a3 3 0 1 1 0 6H11a3 3 0 1 0 0 6h6',
      ],
    },
  },
  {
    disabled: true,
    label: 'Reportes',
    icon: {
      paths: [
        'M6 20V10M12 20V4M18 20v-7',
      ],
    },
  },
  {
    label: 'divider-settings',
    type: 'divider',
  },
  {
    label: 'Configuración',
    disabled: true,
    icon: {
      paths: [
        'M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5z',
        'M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.83 2.83l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.92V20a2 2 0 1 1-4 0v-.14a1 1 0 0 0-.6-.92 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.83-2.83l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.92-.6H4a2 2 0 1 1 0-4h.14a1 1 0 0 0 .92-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.83-2.83l.1.1a1 1 0 0 0 1.1.2h.01a1 1 0 0 0 .59-.92V4a2 2 0 1 1 4 0v.14a1 1 0 0 0 .6.92 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.83 2.83l-.1.1a1 1 0 0 0-.2 1.1v.01a1 1 0 0 0 .92.59H20a2 2 0 1 1 0 4h-.14a1 1 0 0 0-.92.6Z',
      ],
    },
  },
]
