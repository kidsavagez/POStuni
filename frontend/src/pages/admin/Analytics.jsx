import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api'
import { formatIDR } from '../../utils/helpers'
import {
  TrendingUp, ShoppingCart, Package, Users,
  CheckCircle, Clock, XCircle, RefreshCw, BarChart3, Calendar, Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Title
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Filler, Title
)

const COLORS = ['#8ACB88','#648381','#FFBF46','#575761','#a3c7c5','#5a9d58','#e0a93a','#7fb0ac','#b9e9b4','#46605e']

/** Today as YYYY-MM-DD (local). */
const todayStr = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
/** Shift a YYYY-MM-DD date by n days. */
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const firstOfMonth = () => todayStr().slice(0, 8) + '01'
const firstOfYear  = () => todayStr().slice(0, 4) + '-01-01'

const PRESETS = [
  { key: 'today', label: 'Hari Ini',  range: () => ({ from: todayStr(),          to: todayStr(), group: 'day' }) },
  { key: '7d',    label: '7 Hari',    range: () => ({ from: addDays(todayStr(), -6),  to: todayStr(), group: 'day' }) },
  { key: '30d',   label: '30 Hari',   range: () => ({ from: addDays(todayStr(), -29), to: todayStr(), group: 'day' }) },
  { key: '90d',   label: '90 Hari',   range: () => ({ from: addDays(todayStr(), -89), to: todayStr(), group: 'week' }) },
  { key: 'month', label: 'Bulan Ini', range: () => ({ from: firstOfMonth(),       to: todayStr(), group: 'day' }) },
  { key: 'year',  label: 'Tahun Ini', range: () => ({ from: firstOfYear(),        to: todayStr(), group: 'month' }) },
]

export default function Analytics() {
  const [preset, setPreset] = useState('30d')
  const [from, setFrom]   = useState(addDays(todayStr(), -29))
  const [to, setTo]       = useState(todayStr())
  const [group, setGroup] = useState('day')
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (f, t, g) => {
    setLoading(true)
    try {
      const res = await api.getAnalytics({ from: f, to: t, group: g })
      setData(res.data)
    } catch {
      toast.error('Gagal memuat laporan analitik')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(from, to, group) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (p) => {
    const r = PRESETS.find(x => x.key === p).range()
    setPreset(p)
    setFrom(r.from); setTo(r.to); setGroup(r.group)
    load(r.from, r.to, r.group)
  }

  const applyCustom = (nextFrom = from, nextTo = to, nextGroup = group) => {
    setPreset('custom')
    setFrom(nextFrom); setTo(nextTo); setGroup(nextGroup)
    load(nextFrom, nextTo, nextGroup)
  }

  const handleExport = () => {
    if (!data) return
    const r = data.range
    const s = data.summary
    const wb = XLSX.utils.book_new()

    // Sheet 1: summary
    const summaryAoa = [
      ['Laporan Analitik TuniOrder'],
      ['Periode', `${r.from} s/d ${r.to}`],
      ['Dikelompokkan', r.group],
      [],
      ['Metrik', 'Nilai'],
      ['Total Pendapatan', s.totalRevenue],
      ['Pesanan Disetujui', s.approvedOrders],
      ['Rata-rata Pesanan', s.avgOrderValue],
      ['Produk Terjual', s.totalItemsSold],
      ['Pelanggan Aktif', s.uniqueCustomers],
      ['Menunggu', s.pendingOrders],
      ['Ditolak', s.rejectedOrders],
      ['Total Pesanan', s.totalOrders],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), 'Ringkasan')

    // Detail sheets
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.timeSeries || []).map(d => ({ Periode: d.bucket, Pendapatan: d.revenue, Pesanan: d.orders }))
    ), 'Tren Pendapatan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.topProducts || []).map(p => ({ Produk: p.name, Qty: p.qty, Pendapatan: p.revenue }))
    ), 'Produk Terlaris')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.bySales || []).map(x => ({ Sales: x.name, Pesanan: x.orders, Pendapatan: x.revenue }))
    ), 'Pendapatan per Sales')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.topCustomers || []).map(c => ({ Pelanggan: c.name, Pesanan: c.orders, Total: c.revenue }))
    ), 'Pelanggan Teratas')

    XLSX.writeFile(wb, `analitik_${r.from}_sd_${r.to}.xlsx`)
    toast.success('Laporan diexport ke Excel!')
  }

  const s = data?.summary

  const kpis = [
    { label: 'Total Pendapatan', value: formatIDR(s?.totalRevenue || 0), icon: TrendingUp,  color: 'text-success',  bg: 'bg-success/10' },
    { label: 'Pesanan Disetujui', value: s?.approvedOrders ?? 0,         icon: CheckCircle, color: 'text-success',  bg: 'bg-success/10' },
    { label: 'Rata-rata Pesanan', value: formatIDR(s?.avgOrderValue || 0), icon: ShoppingCart, color: 'text-primary-400', bg: 'bg-primary-500/10' },
    { label: 'Produk Terjual',   value: s?.totalItemsSold ?? 0,          icon: Package,     color: 'text-info', bg: 'bg-info/10' },
    { label: 'Pelanggan Aktif',  value: s?.uniqueCustomers ?? 0,         icon: Users,       color: 'text-mint',  bg: 'bg-mint/10' },
    { label: 'Menunggu',         value: s?.pendingOrders ?? 0,           icon: Clock,       color: 'text-warning',   bg: 'bg-warning/10' },
    { label: 'Ditolak',          value: s?.rejectedOrders ?? 0,          icon: XCircle,     color: 'text-danger',    bg: 'bg-danger/10' },
    { label: 'Total Pesanan',    value: s?.totalOrders ?? 0,             icon: BarChart3,   color: 'text-gray-300',  bg: 'bg-gray-500/10' },
  ]

  const ts = data?.timeSeries || []
  const salesRows = data?.bySales || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analitik &amp; Laporan</h1>
          <p className="text-gray-400 text-sm">Ringkasan performa penjualan berdasarkan periode</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={loading || !data} className="btn-primary text-sm">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={() => load(from, to, group)} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                preset === p.key
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-surface text-gray-300 border-surface-border hover:border-primary-500/50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Dari Tanggal</label>
            <input
              type="date" value={from} max={to}
              onChange={e => applyCustom(e.target.value, to, group)}
              className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sampai Tanggal</label>
            <input
              type="date" value={to} min={from} max={todayStr()}
              onChange={e => applyCustom(from, e.target.value, group)}
              className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Kelompokkan</label>
            <div className="flex rounded-lg overflow-hidden border border-surface-border">
              {[['day','Harian'],['week','Mingguan'],['month','Bulanan']].map(([g, lbl]) => (
                <button
                  key={g}
                  onClick={() => applyCustom(from, to, g)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    group === g ? 'bg-primary-500 text-white' : 'bg-surface text-gray-300 hover:text-white'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {data?.range && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
              <Calendar className="w-3.5 h-3.5" />
              {data.range.from} → {data.range.to}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <div key={i} className="card">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-gray-400 text-xs font-medium mb-1">{kpi.label}</p>
                    <p className="text-lg font-bold text-white truncate">{kpi.value}</p>
                  </div>
                  <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue trend */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Tren Pendapatan</h3>
            {ts.length > 0 ? (
              <div className="h-72">
                <Bar
                  data={{
                    labels: ts.map(d => d.bucket),
                    datasets: [{
                      label: 'Pendapatan',
                      data: ts.map(d => d.revenue),
                      backgroundColor: '#8ACB88',
                      borderRadius: 6,
                      maxBarThickness: 48,
                    }],
                  }}
                  options={{
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: c => formatIDR(c.parsed.y) } },
                    },
                    scales: {
                      x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { display: false } },
                      y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => v >= 1e6 ? `${(v/1e6).toFixed(1)}jt` : `${(v/1e3).toFixed(0)}rb` }, grid: { color: '#2a2a45' } },
                    },
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            ) : <p className="text-gray-500 text-sm text-center py-12">Belum ada data pada periode ini</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top products */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Produk Terlaris</h3>
              {data?.topProducts?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs uppercase border-b border-surface-border">
                        <th className="py-2 pr-2">Produk</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 pl-2 text-right">Pendapatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={i} className="border-b border-surface-border/50">
                          <td className="py-2 pr-2 text-white">{p.name}</td>
                          <td className="py-2 px-2 text-center text-gray-300">{p.qty}</td>
                          <td className="py-2 pl-2 text-right text-success font-medium">{formatIDR(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-500 text-sm text-center py-12">Belum ada data</p>}
            </div>

            {/* Revenue by sales */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Pendapatan per Sales</h3>
              {salesRows.length > 0 ? (
                <div className="h-64">
                  <Pie
                    data={{
                      labels: salesRows.map(r => r.name),
                      datasets: [{ data: salesRows.map(r => r.revenue), backgroundColor: COLORS, borderWidth: 0 }],
                    }}
                    options={{
                      plugins: {
                        legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 } } },
                        tooltip: { callbacks: { label: c => `${c.label}: ${formatIDR(c.parsed)}` } },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              ) : <p className="text-gray-500 text-sm text-center py-12">Belum ada data</p>}
            </div>
          </div>

          {/* Top customers */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Pelanggan Teratas</h3>
            {data?.topCustomers?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase border-b border-surface-border">
                      <th className="py-2 pr-2">Pelanggan</th>
                      <th className="py-2 px-2 text-center">Jumlah Pesanan</th>
                      <th className="py-2 pl-2 text-right">Total Belanja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c, i) => (
                      <tr key={i} className="border-b border-surface-border/50">
                        <td className="py-2 pr-2 text-white">{c.name}</td>
                        <td className="py-2 px-2 text-center text-gray-300">{c.orders}</td>
                        <td className="py-2 pl-2 text-right text-success font-medium">{formatIDR(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500 text-sm text-center py-12">Belum ada data</p>}
          </div>
        </>
      )}
    </div>
  )
}
