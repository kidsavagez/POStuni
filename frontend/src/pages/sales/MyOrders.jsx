import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { formatIDR, formatDateTime } from '../../utils/helpers'
import { FileText, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

const TABS = [
  { key: '',         label: 'Semua' },
  { key: 'pending',  label: '⏳ Menunggu' },
  { key: 'approved', label: '✅ Disetujui' },
  { key: 'rejected', label: '❌ Ditolak' },
]

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.getOrders(tab)
      .then(res => setOrders(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Pesanan Saya</h1>
        <p className="text-gray-400 text-sm">{orders.length} pesanan ditemukan</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-surface-card text-gray-400 hover:text-white border border-surface-border'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Tidak ada pesanan ditemukan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.order_id} className="card">
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer"
                onClick={() => setExpanded(expanded === order.order_id ? null : order.order_id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white">{order.order_id}</span>
                    <span className={`badge-${order.status}`}>
                      {order.status === 'pending' ? '⏳ Menunggu' : order.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    <span className="text-gray-300">{order.customer_name}</span> • {formatDateTime(order.created_at)}
                  </p>
                  {order.rejection_reason && (
                    <p className="text-xs text-danger mt-1">Ditolak: {order.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {order.status === 'approved' && order.invoice_id && (
                    <Link
                      to={`/sales/invoice/${order.invoice_id}`}
                      id={`btn-view-invoice-${order.invoice_id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-xs text-success border border-success/30 hover:bg-success/10 px-3 py-1.5 rounded-lg transition-all duration-200"
                    >
                      <FileText className="w-3.5 h-3.5" /> Lihat Invoice
                    </Link>
                  )}
                  <span className="text-primary-400 font-bold whitespace-nowrap">{formatIDR(order.total_amount)}</span>
                  {expanded === order.order_id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === order.order_id && (
                <div className="mt-4 pt-4 border-t border-surface-border animate-fade-in">
                  <div className="table-wrapper mb-3">
                    <table className="w-full">
                      <thead className="table-head">
                        <tr>{['Produk','Qty','Harga Satuan','Diskon','Subtotal'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((item, i) => (
                          <tr key={i} className="table-tr">
                            <td className="table-td font-medium text-white">{item.product_name}</td>
                            <td className="table-td">{item.qty}</td>
                            <td className="table-td">{formatIDR(item.unit_price)}</td>
                            <td className="table-td">{item.discount_pct > 0 ? `${item.discount_pct}%` : '-'}</td>
                            <td className="table-td font-semibold text-success">{formatIDR(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col items-end text-sm space-y-1">
                    <div className="flex gap-6"><span className="text-gray-400">Subtotal</span><span className="w-28 text-right text-white">{formatIDR(order.subtotal)}</span></div>
                    {order.discount_global > 0 && <div className="flex gap-6"><span className="text-gray-400">Diskon ({order.discount_global}%)</span><span className="w-28 text-right text-danger">- {formatIDR(order.discount_amount)}</span></div>}
                    <div className="flex gap-6"><span className="text-gray-400">PPN ({order.tax_rate}%)</span><span className="w-28 text-right text-gray-300">{formatIDR(order.tax_amount)}</span></div>
                    <div className="flex gap-6 pt-2 border-t border-surface-border"><span className="font-bold text-white">TOTAL</span><span className="w-28 text-right font-bold text-primary-400">{formatIDR(order.total_amount)}</span></div>
                  </div>
                  {order.note && <p className="text-xs text-gray-500 mt-3 italic">Catatan: "{order.note}"</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
