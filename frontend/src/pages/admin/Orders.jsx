import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatIDR, formatDateTime } from '../../utils/helpers'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'pending',  label: 'Menunggu',  cls: 'badge-pending' },
  { key: 'approved', label: 'Disetujui', cls: 'badge-approved' },
  { key: 'rejected', label: 'Ditolak',   cls: 'badge-rejected' },
  { key: '',         label: 'Semua',     cls: '' },
]

function OrderCard({ order, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const handleExpand = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && !detail) {
      setLoadingDetail(true)
      try {
        const res = await api.getOrder(order.order_id)
        setDetail(res.data)
      } catch {}
      finally { setLoadingDetail(false) }
    }
  }
  return (
    <div className="card mb-3">
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-white">{order.order_id}</span>
            <span className={`badge-${order.status}`}>
              {order.status === 'pending' ? '⏳ Menunggu' : order.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="text-gray-300">{order.customer_name}</span> •
            Sales: <span className="text-gray-300">{order.sales_name}</span> •
            {formatDateTime(order.created_at)}
          </p>
          {order.note && <p className="text-xs text-gray-500 mt-1 italic">"{order.note}"</p>}
          {order.rejection_reason && (
            <p className="text-xs text-danger mt-1">Alasan: {order.rejection_reason}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-primary-400 whitespace-nowrap">{formatIDR(order.total_amount)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-border animate-fade-in">
          <div className="table-wrapper mb-4">
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Produk','Qty','Harga Satuan','Diskon','Subtotal'].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i} className="table-tr">
                    <td className="table-td font-medium text-white">{item.product_name}</td>
                    <td className="table-td">{item.qty} {item.unit || ''}</td>
                    <td className="table-td">{formatIDR(item.unit_price)}</td>
                    <td className="table-td">{item.discount_pct > 0 ? `${item.discount_pct}%` : '-'}</td>
                    <td className="table-td font-semibold text-success">{formatIDR(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end text-sm space-y-1 mb-4">
            <div className="flex gap-8">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white font-medium w-32 text-right">{formatIDR(order.subtotal)}</span>
            </div>
            {order.discount_global > 0 && (
              <div className="flex gap-8">
                <span className="text-gray-400">Diskon Global ({order.discount_global}%)</span>
                <span className="text-danger font-medium w-32 text-right">- {formatIDR(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex gap-8">
              <span className="text-gray-400">PPN ({order.tax_rate}%)</span>
              <span className="text-gray-300 font-medium w-32 text-right">{formatIDR(order.tax_amount)}</span>
            </div>
            <div className="flex gap-8 pt-2 border-t border-surface-border">
              <span className="text-white font-bold">TOTAL</span>
              <span className="text-primary-400 font-bold text-base w-32 text-right">{formatIDR(order.total_amount)}</span>
            </div>
          </div>

          {order.status === 'pending' && (
            <div className="flex gap-3 justify-end">
              <button
                id={`btn-reject-order-${order.order_id}`}
                onClick={() => onReject(order.order_id)}
                className="btn-danger text-sm"
              >
                <XCircle className="w-4 h-4" /> Tolak
              </button>
              <button
                id={`btn-approve-order-${order.order_id}`}
                onClick={() => onApprove(order.order_id)}
                className="btn-success text-sm"
              >
                <CheckCircle className="w-4 h-4" /> Setujui
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.getOrders(tab)
      setOrders(res.data)
    } catch { toast.error('Gagal memuat pesanan') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  const handleApprove = async (id) => {
    if (!confirm(`Setujui pesanan ${id}?`)) return
    try { await api.approveOrder(id); toast.success('Pesanan disetujui! Invoice dibuat.'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Gagal menyetujui') }
  }

  const handleReject = async (id) => {
    const reason = prompt('Masukkan alasan penolakan:')
    if (!reason?.trim()) return
    try { await api.rejectOrder(id, reason); toast.success('Pesanan ditolak.'); load() }
    catch { toast.error('Gagal menolak pesanan') }
  }

  const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})

  const filtered = orders.filter(o =>
    !search ||
    o.order_id.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.sales_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Manajemen Pesanan</h1>
        <p className="text-gray-400 text-sm">{orders.length} pesanan ditemukan</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            id={`tab-orders-${t.key || 'all'}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-surface-hover text-gray-400 hover:text-white border border-surface-border'
            }`}
          >
            {t.label}
            {t.key === 'pending' && counts.pending > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-warning text-black text-xs rounded-full font-bold">
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-10" placeholder="Cari ID, pelanggan, sales..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Tidak ada pesanan ditemukan</p>
        </div>
      ) : filtered.map(order => (
        <OrderCard key={order.order_id} order={order} onApprove={handleApprove} onReject={handleReject} />
      ))}
    </div>
  )
}
