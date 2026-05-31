import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatIDR, formatDateTime } from '../../utils/helpers'
import {
  Users, Package, ClipboardList, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Clock, RefreshCw
} from 'lucide-react'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
} from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const COLORS = ['#8ACB88','#648381','#FFBF46','#575761','#a3c7c5','#5a9d58','#e0a93a','#7fb0ac']

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.getOrders(),
        api.getProducts()
      ])
      setOrders(ordersRes.data)
      setProducts(productsRes.data)

      const approved = ordersRes.data.filter(o => o.status === 'approved')
      const pending = ordersRes.data.filter(o => o.status === 'pending')
      const totalRevenue = approved.reduce((s, o) => s + o.total_amount, 0)

      // Sales breakdown
      const salesMap = {}
      approved.forEach(o => {
        const name = o.sales_name || 'Unknown'
        salesMap[name] = (salesMap[name] || 0) + o.total_amount
      })

      // Product breakdown
      const productMap = {}
      approved.forEach(o => {
        if (o.items) o.items.forEach(item => {
          productMap[item.product_name] = (productMap[item.product_name] || 0) + item.qty
        })
      })

      // Last 7 days revenue
      const days = [...Array(7)].map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().slice(0, 10)
      })
      const dailyRevenue = days.map(day => ({
        day: day.slice(5),
        total: approved
          .filter(o => o.created_at?.slice(0, 10) === day)
          .reduce((s, o) => s + o.total_amount, 0)
      }))

      setStats({
        totalCustomers: productsRes.data.length,
        totalProducts: productsRes.data.length,
        pendingCount: pending.length,
        totalRevenue,
        salesMap,
        productMap: Object.fromEntries(
          Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
        ),
        dailyRevenue,
        lowStock: productsRes.data.filter(p => p.stock_qty <= p.low_stock_alert && p.is_active),
      })
    } catch (err) {
      toast.error('Gagal memuat data dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Customers count separately
  const [custCount, setCustCount] = useState(0)
  useEffect(() => {
    api.getCustomers().then(r => setCustCount(r.data.length)).catch(() => {})
  }, [])

  const pendingOrders = orders.filter(o => o.status === 'pending')

  const handleApprove = async (id) => {
    try {
      await api.approveOrder(id)
      toast.success('Pesanan disetujui!')
      load()
    } catch { toast.error('Gagal menyetujui pesanan') }
  }

  const handleReject = async (id) => {
    const reason = prompt('Alasan penolakan:')
    if (!reason) return
    try {
      await api.rejectOrder(id, reason)
      toast.success('Pesanan ditolak.')
      load()
    } catch { toast.error('Gagal menolak pesanan') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const salesLabels = stats ? Object.keys(stats.salesMap) : []
  const salesData = stats ? Object.values(stats.salesMap) : []
  const prodLabels = stats ? Object.keys(stats.productMap) : []
  const prodData = stats ? Object.values(stats.productMap) : []

  const pieOpts = {
    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 } } } },
    maintainAspectRatio: false,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm">Selamat datang kembali, Admin</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pelanggan', value: custCount, icon: Users, color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Total Produk', value: stats?.totalProducts || 0, icon: Package, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Menunggu Persetujuan', value: stats?.pendingCount || 0, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Total Pendapatan', value: formatIDR(stats?.totalRevenue || 0), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
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

      {/* Low Stock Alert */}
      {stats?.lowStock?.length > 0 && (
        <div className="card border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-warning">Stok Rendah</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.lowStock.map(p => (
              <span key={p.product_id} className="px-3 py-1 bg-warning/10 border border-warning/20 rounded-full text-xs text-warning">
                {p.name} — {p.stock_qty} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue by Sales */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Pendapatan per Sales</h3>
          {salesLabels.length > 0 ? (
            <div className="h-52">
              <Pie
                data={{
                  labels: salesLabels,
                  datasets: [{ data: salesData, backgroundColor: COLORS, borderWidth: 0 }],
                }}
                options={pieOpts}
              />
            </div>
          ) : <p className="text-gray-500 text-sm text-center py-8">Belum ada data</p>}
        </div>

        {/* Top Products */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Produk Terlaris</h3>
          {prodLabels.length > 0 ? (
            <div className="h-52">
              <Pie
                data={{
                  labels: prodLabels,
                  datasets: [{ data: prodData, backgroundColor: COLORS, borderWidth: 0 }],
                }}
                options={pieOpts}
              />
            </div>
          ) : <p className="text-gray-500 text-sm text-center py-8">Belum ada data</p>}
        </div>

        {/* Daily Revenue */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Pendapatan 7 Hari Terakhir</h3>
          <div className="h-52">
            <Bar
              data={{
                labels: (stats?.dailyRevenue || []).map(d => d.day),
                datasets: [{
                  label: 'Pendapatan',
                  data: (stats?.dailyRevenue || []).map(d => d.total),
                  backgroundColor: '#8ACB88',
                  borderRadius: 6,
                }],
              }}
              options={{
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { display: false } },
                  y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => `${(v/1e6).toFixed(1)}jt` }, grid: { color: '#2a2a45' } },
                },
                maintainAspectRatio: false,
              }}
            />
          </div>
        </div>
      </div>

      {/* Pending Orders */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" />
          Menunggu Persetujuan
          {pendingOrders.length > 0 && (
            <span className="ml-auto px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full font-bold">
              {pendingOrders.length}
            </span>
          )}
        </h3>
        {pendingOrders.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">✅ Tidak ada pesanan yang menunggu</p>
        ) : (
          <div className="space-y-3">
            {pendingOrders.slice(0, 5).map(order => (
              <div key={order.order_id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-surface rounded-lg border border-surface-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{order.order_id}</p>
                  <p className="text-xs text-gray-400">
                    {order.customer_name} • {order.sales_name} • {formatDateTime(order.created_at)}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary-400">{formatIDR(order.total_amount)}</p>
                <div className="flex gap-2">
                  <button
                    id={`btn-approve-${order.order_id}`}
                    onClick={() => handleApprove(order.order_id)}
                    className="btn-success text-xs px-3 py-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Setuju
                  </button>
                  <button
                    id={`btn-reject-${order.order_id}`}
                    onClick={() => handleReject(order.order_id)}
                    className="btn-danger text-xs px-3 py-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
