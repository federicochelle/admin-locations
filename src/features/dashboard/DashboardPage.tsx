import { useMemo } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import PageContainer from '../../components/ui/PageContainer'
import type { Profile } from '../auth/auth-context'
import useAuth from '../auth/useAuth'
import DashboardPendingRequestsCard from './DashboardPendingRequestsCard'
import DashboardRecentActivityCard from './DashboardRecentActivityCard'
import DashboardUpcomingReservationsCard from './DashboardUpcomingReservationsCard'

function getDashboardWelcomeTitle(
  profile: Profile | null,
  userMetadata: Record<string, unknown> | null | undefined,
  email: string | undefined,
) {
  const profileFullName = profile?.full_name?.trim() ?? ''

  if (profileFullName.length > 0) {
    return `Bienvenido al panel administrativo, ${profileFullName}!`
  }

  const profileEmail = profile?.email?.trim() ?? ''

  if (profileEmail.length > 0) {
    return `Bienvenido al Panel Administrativo, ${profileEmail}!`
  }

  const fullName =
    typeof userMetadata?.full_name === 'string' ? userMetadata.full_name.trim() : ''

  if (fullName.length > 0) {
    return `Bienvenido al Panel Administrativo, ${fullName}!`
  }

  const name = typeof userMetadata?.name === 'string' ? userMetadata.name.trim() : ''

  if (name.length > 0) {
    return `Bienvenido al panel administrativo, ${name}!`
  }

  if (email && email.trim().length > 0) {
    return `Bienvenido al panel administrativo, ${email}!`
  }

  return 'Bienvenido al panel administrativo'
}

function DashboardPage() {
  const { currentUser, profile } = useAuth()

  const welcomeTitle = useMemo(
    () =>
      getDashboardWelcomeTitle(
        profile,
        currentUser?.user_metadata,
        currentUser?.email,
      ),
    [currentUser?.email, currentUser?.user_metadata, profile],
  )

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: welcomeTitle }],
      title: welcomeTitle,
    }),
    [welcomeTitle],
  )

  useLayoutHeader(headerConfig)

  return (
    <PageContainer
      title={welcomeTitle}
      description="Vista general del panel administrativo."
      hideHeader
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPendingRequestsCard />
        <DashboardUpcomingReservationsCard />
        <div className="lg:col-span-2">
          <DashboardRecentActivityCard />
        </div>
      </div>
    </PageContainer>
  )
}

export default DashboardPage
