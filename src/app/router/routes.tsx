import { createBrowserRouter, Navigate } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'
import { routePaths } from './route-paths'
import ProtectedRoute from './ProtectedRoute'
import DashboardPage from '../../features/dashboard/DashboardPage'
import LocationsPage from '../../features/locations/LocationsPage'
import LocationCreatePage from '../../features/locations/LocationCreatePage'
import LocationEditPage from '../../features/locations/LocationEditPage'
import LoginPage from '../../features/auth/LoginPage'
import OwnersPage from '../../features/owners/OwnersPage'
import OwnerCreatePage from '../../features/owners/OwnerCreatePage'
import OwnerEditPage from '../../features/owners/OwnerEditPage'
import CategoriesPage from '../../features/categories/CategoriesPage'
import CategoryCreatePage from '../../features/categories/CategoryCreatePage'
import CategoryEditPage from '../../features/categories/CategoryEditPage'
import ActivityHistoryPage from '../../features/activity/ActivityHistoryPage'
import FeaturesPage from '../../features/features-admin/FeaturesPage'
import FeatureCreatePage from '../../features/features-admin/FeatureCreatePage'
import FeatureEditPage from '../../features/features-admin/FeatureEditPage'
import SettingsPage from '../../features/settings/SettingsPage'

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
        ],
      },
    ],
  },
])
