import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'

// Layouts
import AdminLayout from './layouts/AdminLayout'
import SalesLayout from './layouts/SalesLayout'

// Pages - Auth
import Login from './pages/Login'

// Pages - Admin
import AdminDashboard  from './pages/admin/Dashboard'
import Customers       from './pages/admin/Customers'
import Products        from './pages/admin/Products'
import Orders          from './pages/admin/Orders'
import Analytics       from './pages/admin/Analytics'
import Accounts        from './pages/admin/Accounts'
import DatabaseEditor  from './pages/admin/DatabaseEditor'
import SettingsPage    from './pages/admin/Settings'

// Pages - Sales
import SalesDashboard from './pages/sales/Dashboard'
import NewOrder       from './pages/sales/NewOrder'
import MyOrders       from './pages/sales/MyOrders'
import InvoicePage    from './pages/sales/Invoice'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a2e',
              color: '#fff',
              border: '1px solid #2a2a45',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Root */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="products"  element={<Products />} />
              <Route path="orders"    element={<Orders />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="accounts"  element={<Accounts />} />
              <Route path="database"  element={<DatabaseEditor />} />
              <Route path="settings"  element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Sales routes */}
          <Route element={<RequireAuth role="sales" />}>
            <Route path="/sales" element={<SalesLayout />}>
              <Route index element={<SalesDashboard />} />
              <Route path="new-order"          element={<NewOrder />} />
              <Route path="orders"             element={<MyOrders />} />
              <Route path="invoice/:invoiceId" element={<InvoicePage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
