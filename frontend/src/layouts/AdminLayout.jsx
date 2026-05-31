import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, Package, ClipboardList, UserCog,
  Database, Settings, LogOut, Menu, X, ChevronRight, Package2, Bell, BarChart3
} from 'lucide-react'

const navItems = [
  { to: '/admin',           label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Pelanggan',     icon: Users },
  { to: '/admin/products',  label: 'Produk',        icon: Package },
  { to: '/admin/orders',    label: 'Pesanan',       icon: ClipboardList },
  { to: '/admin/analytics', label: 'Analitik',      icon: BarChart3 },
  { to: '/admin/accounts',  label: 'Akun Sales',    icon: UserCog },
  { to: '/admin/database',  label: 'Database',      icon: Database },
  { to: '/admin/settings',  label: 'Pengaturan',    icon: Settings },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-30 inset-y-0 left-0 w-64 flex-shrink-0
        bg-surface-card border-r border-surface-border flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">TuniOrder</p>
            <p className="text-xs text-primary-400 font-medium">Admin Panel</p>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="flex-1 text-sm">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-surface-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            id="btn-logout"
            onClick={handleLogout}
            className="sidebar-link w-full text-danger hover:text-danger hover:bg-danger/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-surface-card border-b border-surface-border flex items-center px-4 gap-4">
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-xs text-gray-400 hidden sm:block">System Online</span>
          </div>
          <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
