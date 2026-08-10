import { createBrowserRouter, Navigate } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'
import { routePaths } from './route-paths'
import ProtectedRoute from './ProtectedRoute'
import DashboardPage from '../../features/dashboard/DashboardPage'
import LocationsPage from '../../features/locations/LocationsPage'
import LocationCreatePage from '../../features/locations/LocationCreatePage'
import LocationViewPage from '../../features/locations/LocationViewPage'
import LocationEditPage from '../../features/locations/LocationEditPage'
import LoginPage from '../../features/auth/LoginPage'
import OwnersPage from '../../features/owners/OwnersPage'
import OwnerCreatePage from '../../features/owners/OwnerCreatePage'
import OwnerEditPage from '../../features/owners/OwnerEditPage'
import OwnerViewPage from '../../features/owners/OwnerViewPage'
import CategoriesPage from '../../features/categories/CategoriesPage'
import CategoryCreatePage from '../../features/categories/CategoryCreatePage'
import CategoryEditPage from '../../features/categories/CategoryEditPage'
import ActivityHistoryPage from '../../features/activity/ActivityHistoryPage'
import ReservationDayPage from '../../features/reservations/ReservationDayPage'
import ReservationDetailPage from '../../features/reservations/ReservationDetailPage'
import ReservationsPage from '../../features/reservations/ReservationsPage'
import FeaturesPage from '../../features/features-admin/FeaturesPage'
import FeatureCreatePage from '../../features/features-admin/FeatureCreatePage'
import FeatureEditPage from '../../features/features-admin/FeatureEditPage'
import SettingsPage from '../../features/settings/SettingsPage'
import GoogleCalendarDetailPage from '../../features/settings/GoogleCalendarDetailPage'
import SettingsConnectionDetailPage from '../../features/settings/SettingsConnectionDetailPage'
import AdminLocationRequestsPage from '../../features/requests-admin/AdminLocationRequestsPage'
import AdminRequestDetailPage from '../../features/requests-admin/AdminRequestDetailPage'
import ProposalDetailPage from '../../features/proposals/ProposalDetailPage'
import ProposalsPage from '../../features/proposals/ProposalsPage'
import UsersPage from '../../features/users/UsersPage'
import UserDetailPage from '../../features/users/UserDetailPage'

export const router = createBrowserRouter([
  {
    path: routePaths.login,
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to={routePaths.dashboard} replace />,
          },
          {
            path: routePaths.dashboard.slice(1),
            element: <DashboardPage />,
          },
          {
            path: routePaths.locations.slice(1),
            element: <LocationsPage />,
          },
          {
            path: routePaths.locationNew.slice(1),
            element: <LocationCreatePage />,
          },
          {
            path: routePaths.locationDetailPattern.slice(1),
            element: <LocationViewPage />,
          },
          {
            path: routePaths.locationEditPattern.slice(1),
            element: <LocationEditPage />,
          },
          {
            path: routePaths.owners.slice(1),
            element: <OwnersPage />,
          },
          {
            path: routePaths.ownerNew.slice(1),
            element: <OwnerCreatePage />,
          },
          {
            path: routePaths.ownerDetailPattern.slice(1),
            element: <OwnerViewPage />,
          },
          {
            path: routePaths.ownerEditPattern.slice(1),
            element: <OwnerEditPage />,
          },
          {
            path: routePaths.categories.slice(1),
            element: <CategoriesPage />,
          },
          {
            path: routePaths.categoryNew.slice(1),
            element: <CategoryCreatePage />,
          },
          {
            path: routePaths.categoryEditPattern.slice(1),
            element: <CategoryEditPage />,
          },
          {
            path: routePaths.activity.slice(1),
            element: <ActivityHistoryPage />,
          },
          {
            path: routePaths.reservationDayPattern.slice(1),
            element: <ReservationDayPage />,
          },
          {
            path: routePaths.reservationDetailPattern.slice(1),
            element: <ReservationDetailPage />,
          },
          {
            path: routePaths.reservations.slice(1),
            element: <ReservationsPage />,
          },
          {
            path: routePaths.requests.slice(1),
            element: <AdminLocationRequestsPage />,
          },
          {
            path: routePaths.requestDetailPattern.slice(1),
            element: <AdminRequestDetailPage />,
          },
          {
            path: routePaths.users.slice(1),
            element: <UsersPage />,
          },
          {
            path: routePaths.userDetailPattern.slice(1),
            element: <UserDetailPage />,
          },
          {
            path: routePaths.proposals.slice(1),
            element: <ProposalsPage />,
          },
          {
            path: routePaths.proposalDetailPattern.slice(1),
            element: <ProposalDetailPage />,
          },
          {
            path: routePaths.features.slice(1),
            element: <FeaturesPage />,
          },
          {
            path: routePaths.featureNew.slice(1),
            element: <FeatureCreatePage />,
          },
          {
            path: routePaths.featureEditPattern.slice(1),
            element: <FeatureEditPage />,
          },
          {
            path: routePaths.settings.slice(1),
            element: <SettingsPage />,
          },
          {
            path: routePaths.settingsConnectionDetailPattern.slice(1),
            element: <SettingsConnectionDetailPage />,
          },
          {
            path: routePaths.googleCalendarSettingsDetail.slice(1),
            element: <GoogleCalendarDetailPage />,
          },
        ],
      },
    ],
  },
])
