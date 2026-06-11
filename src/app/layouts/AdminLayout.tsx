import { Outlet } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import Sidebar from '../../components/navigation/Sidebar'
import { LayoutHeaderProvider } from './LayoutHeaderContext'

function AdminLayout() {
  return (
    <LayoutHeaderProvider>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <Sidebar />
        <div className="min-h-screen md:ml-72">
          <Header />
          <main className="px-6 py-4 sm:px-8 sm:py-5">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutHeaderProvider>
  )
}

export default AdminLayout
