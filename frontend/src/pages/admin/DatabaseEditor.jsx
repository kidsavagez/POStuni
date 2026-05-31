import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatDateTime } from '../../utils/helpers'
import { formatIDR } from '../../utils/helpers'
import { Database, RefreshCw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const TABLE_TABS = ['customers', 'products', 'orders', 'users', 'audit_log']
const TABLE_LABELS = { customers: 'Pelanggan', products: 'Produk', orders: 'Pesanan', users: 'Pengguna', audit_log: 'Log Audit' }

export default function DatabaseEditor() {
  const [activeTable, setActiveTable] = useState('customers')
  const [data, setData] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      if (activeTable === 'audit_log') {
        const res = await api.getAuditLog(page)
        setAuditLog(res.data.logs || [])
      } else if (activeTable === 'customers') {
        const res = await api.getCustomers(); setData(res.data)
      } else if (activeTable === 'products') {
        const res = await api.getProducts(); setData(res.data)
      } else if (activeTable === 'orders') {
        const res = await api.getOrders(); setData(res.data)
      } else if (activeTable === 'users') {
        const res = await api.getUsers(); setData(res.data)
      }
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeTable, page])

  const renderTable = () => {
    if (activeTable === 'audit_log') {
      return (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Waktu','User','Aksi','Tabel','ID Record','Perubahan'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {auditLog.map((log, i) => (
                <tr key={i} className="table-tr">
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="table-td text-xs text-primary-400">{log.user_id}</td>
                  <td className="table-td text-xs font-mono text-warning">{log.action}</td>
                  <td className="table-td text-xs text-gray-400">{log.table_name}</td>
                  <td className="table-td text-xs font-mono text-gray-400">{log.record_id}</td>
                  <td className="table-td text-xs text-gray-500 max-w-xs truncate">{log.new_value ? `→ ${log.new_value.slice(0, 80)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeTable === 'customers') {
      return (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-head">
              <tr>{['ID','Nama','Email','Telepon','Alamat','Dibuat'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="table-tr">
                  <td className="table-td font-mono text-primary-400 text-xs">{r.customer_id}</td>
                  <td className="table-td text-white">{r.name}</td>
                  <td className="table-td text-gray-400">{r.email}</td>
                  <td className="table-td text-gray-400">{r.phone}</td>
                  <td className="table-td text-gray-400 max-w-xs truncate">{r.address}</td>
                  <td className="table-td text-xs text-gray-500">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeTable === 'products') {
      return (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-head">
              <tr>{['ID','Nama','Harga','Satuan','Stok','Alert Stok','Aktif'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="table-tr">
                  <td className="table-td font-mono text-primary-400 text-xs">{r.product_id}</td>
                  <td className="table-td text-white">{r.name}</td>
                  <td className="table-td text-success">{formatIDR(r.price)}</td>
                  <td className="table-td text-gray-400">{r.unit}</td>
                  <td className="table-td font-semibold text-white">{r.stock_qty}</td>
                  <td className="table-td text-gray-400">{r.low_stock_alert}</td>
                  <td className="table-td">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                      {r.is_active ? 'Ya' : 'Tidak'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeTable === 'orders') {
      return (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-head">
              <tr>{['ID Order','Pelanggan','Sales','Status','Total','Dibuat','Disetujui'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="table-tr">
                  <td className="table-td font-mono text-primary-400 text-xs">{r.order_id}</td>
                  <td className="table-td text-gray-300">{r.customer_name}</td>
                  <td className="table-td text-gray-300">{r.sales_name}</td>
                  <td className="table-td"><span className={`badge-${r.status}`}>{r.status}</span></td>
                  <td className="table-td font-semibold text-success">{formatIDR(r.total_amount)}</td>
                  <td className="table-td text-xs text-gray-500">{formatDateTime(r.created_at)}</td>
                  <td className="table-td text-xs text-gray-500">{r.approved_at ? formatDateTime(r.approved_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeTable === 'users') {
      return (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-head">
              <tr>{['ID','Nama','Email','Role','Telegram ID','Status','Dibuat'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="table-tr">
                  <td className="table-td font-mono text-primary-400 text-xs">{r.user_id}</td>
                  <td className="table-td text-white">{r.name}</td>
                  <td className="table-td text-gray-400">{r.email}</td>
                  <td className="table-td"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.role === 'admin' ? 'bg-warning/20 text-warning' : 'bg-primary-500/20 text-primary-400'}`}>{r.role}</span></td>
                  <td className="table-td text-gray-500 text-xs">{r.telegram_chat_id || '-'}</td>
                  <td className="table-td"><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>{r.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="table-td text-xs text-gray-500">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="w-6 h-6 text-primary-400" /> Database Viewer</h1>
          <p className="text-gray-400 text-sm">Lihat semua data sistem (read-only view)</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABLE_TABS.map(t => (
          <button
            key={t}
            onClick={() => { setActiveTable(t); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTable === t ? 'bg-primary-600 text-white' : 'bg-surface-hover text-gray-400 hover:text-white border border-surface-border'}`}
          >
            {TABLE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="animate-fade-in">
          {renderTable()}
          {activeTable === 'audit_log' && (
            <div className="flex justify-center gap-3 mt-4">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-30">← Prev</button>
              <span className="text-gray-400 text-sm self-center">Hal {page}</span>
              <button disabled={auditLog.length < 50} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
