import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, PlusCircle, ClipboardList, LogOut, Package2, Menu, X } from 'lucide-react'

const navItems = [
  { to: '/sales',            label: 'Dashboard',   icon: LayoutDashboard, end: true },
  { to: '/sales/new-order',  label: 'Buat Pesanan', icon: PlusCircle },
  { to: '/sales/orders',     label: 'Pesanan Saya', icon: ClipboardList },
]

export default function SalesLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-surface-card border-b border-surface-border glass">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Package2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">TuniOrder</span>
            <span className="text-xs text-primary-400 bg-primary-600/20 px-2 py-0.5 rounded-full hidden sm:block">Sales</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 md:hidden" />

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 gradient-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-gray-300 hidden lg:block">{user?.name}</span>
            </div>
            <button
              id="btn-logout-sales"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-danger transition-colors px-2 py-1.5 rounded-lg hover:bg-danger/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Keluar</span>
            </button>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-4 pb-3 border-t border-surface-border space-y-1 animate-slide-up">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                    isActive ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
