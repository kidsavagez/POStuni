import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api'
import { formatIDR, formatDateTime } from '../../utils/helpers'
import { PlusCircle, ClipboardList, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function SalesDashboard() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getOrders().then(res => setOrders(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const pending  = orders.filter(o => o.status === 'pending')
  const approved = orders.filter(o => o.status === 'approved')
  const rejected = orders.filter(o => o.status === 'rejected')
  const totalRev = approved.reduce((s, o) => s + o.total_amount, 0)

  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="card gradient-primary border-0">
        <h1 className="text-xl font-bold text-white">Selamat datang, {user?.name}! 👋</h1>
        <p className="text-white/80 text-sm mt-1">Siap membuat pesanan baru hari ini?</p>
        <Link to="/sales/new-order" id="btn-new-order-dash" className="inline-flex items-center gap-2 mt-4 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">
          <PlusCircle className="w-4 h-4" /> Buat Pesanan Baru
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pesanan', value: orders.length, icon: ClipboardList, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Menunggu', value: pending.length, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Disetujui', value: approved.length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Total Nilai', value: formatIDR(totalRev), icon: TrendingUp, color: 'text-primary-400', bg: 'bg-primary-600/10' },
        ].map((kpi, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
              </div>
              <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Pesanan Terbaru</h2>
          <Link to="/sales/orders" className="text-primary-400 hover:text-primary-300 text-sm transition-colors">Lihat Semua →</Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-3">Belum ada pesanan</p>
            <Link to="/sales/new-order" className="btn-primary text-sm inline-flex">
              <PlusCircle className="w-4 h-4" /> Buat Pesanan Pertama
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.order_id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-surface rounded-lg border border-surface-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-white font-bold">{order.order_id}</span>
                    <span className={`badge-${order.status}`}>
                      {order.status === 'pending' ? '⏳ Menunggu' : order.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{order.customer_name} • {formatDateTime(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-primary-400">{formatIDR(order.total_amount)}</span>
                  {order.status === 'approved' && order.invoice_id && (
                    <Link to={`/sales/invoice/${order.invoice_id}`} className="text-xs text-success hover:text-success/80 border border-success/30 px-2 py-1 rounded-lg transition-colors">
                      🧾 Invoice
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
