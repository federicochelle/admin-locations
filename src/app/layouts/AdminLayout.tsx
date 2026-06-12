import { Outlet } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import Sidebar from '../../components/navigation/Sidebar'
import { LayoutHeaderProvider } from './LayoutHeaderContext'

function AdminLayout() {
  return (
    <LayoutHeaderProvider>
      <div className="min-h-screen bg-[#121c2a] text-slate-900">
        <Sidebar />
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.12),_transparent_28%),linear-gradient(180deg,_#1a2636_0%,_#162131_52%,_#121c2a_100%)] md:ml-72">
          <Header />
          <main className="relative px-6 py-4 sm:px-8 sm:py-5">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutHeaderProvider>
  )
}

export default AdminLayout
