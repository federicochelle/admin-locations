import type { AdminModalVariant, AdminToastVariant } from './admin-feedback.types'

type AdminFeedbackIconProps = {
  className?: string
  variant: AdminModalVariant | AdminToastVariant
}

function AdminFeedbackIcon({ className = 'h-6 w-6', variant }: AdminFeedbackIconProps) {
  const sharedProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  if (variant === 'success') {
    return (
      <svg aria-hidden="true" className={className} {...sharedProps}>
        <path d="M20 11a8 8 0 1 1-4.2-7" />
        <path d="m9 12 2 2 5-5" />
      </svg>
    )
  }

  if (variant === 'danger') {
    return (
      <svg aria-hidden="true" className={className} {...sharedProps}>
        <path d="M4 7h16" />
        <path d="M9 7V5h6v2" />
        <path d="m18 7-1 12H7L6 7" />
        <path d="M10 11v4M14 11v4" />
      </svg>
    )
  }

  if (variant === 'warning') {
    return (
      <svg aria-hidden="true" className={className} {...sharedProps}>
        <path d="M12 4 3.7 19h16.6L12 4Z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </svg>
    )
  }

  if (variant === 'error') {
    return (
      <svg aria-hidden="true" className={className} {...sharedProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
      </svg>
    )
  }

  if (variant === 'confirm') {
    return (
      <svg aria-hidden="true" className={className} {...sharedProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.8 9.5a2.4 2.4 0 1 1 3.9 1.9c-.9.7-1.7 1.1-1.7 2.4" />
        <path d="M12 16.5h.01" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className={className} {...sharedProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export default AdminFeedbackIcon
