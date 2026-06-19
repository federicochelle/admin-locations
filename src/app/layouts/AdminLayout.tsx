import { Outlet } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import Sidebar from '../../components/navigation/Sidebar'
import { LayoutHeaderProvider } from './LayoutHeaderContext'

function AdminLayout() {
  return (
    <LayoutHeaderProvider>
      <div className="min-h-screen bg-black text-slate-900">
        <Sidebar />
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.10),_transparent_24%),linear-gradient(180deg,_#111111_0%,_#151515_52%,_#1a1a1a_100%)] md:ml-72">
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
