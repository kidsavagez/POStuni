import { useEffect, useState, useRef } from 'react'
import { api } from '../../api'
import { formatIDR, formatDateTime } from '../../utils/helpers'
import { Plus, Search, Edit2, Trash2, Upload, Download, X, Check, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product || { name: '', price: '', unit: 'pcs', stock_qty: 0, low_stock_alert: 10, description: '' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!product?.product_id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) await api.updateProduct(product.product_id, form)
      else await api.createProduct(form)
      toast.success(isEdit ? 'Produk diperbarui!' : 'Produk ditambahkan!')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border sticky top-0 bg-surface-card">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nama Produk *</label>
            <input className="input" placeholder="Nama produk" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Harga (IDR) *</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="label">Satuan</label>
              <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                {['pcs','kg','liter','box','set','lembar','meter','lusin','kodi'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stok Awal</label>
              <input className="input" type="number" min="0" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} />
            </div>
            <div>
              <label className="label">Alert Stok Rendah</label>
              <input className="input" type="number" min="0" value={form.low_stock_alert} onChange={e => setForm({ ...form, low_stock_alert: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input resize-none h-16" placeholder="Deskripsi produk (opsional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RestockModal({ product, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!qty || qty <= 0) return
    setSaving(true)
    try {
      await api.restockProduct(product.product_id, Number(qty))
      toast.success(`Stok ${product.name} ditambah ${qty} ${product.unit}`)
      onSaved()
    } catch { toast.error('Gagal restock') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-semibold text-white">Tambah Stok — {product.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Stok saat ini: <span className="text-white font-semibold">{product.stock_qty} {product.unit}</span></label>
            <input className="input" type="number" min="1" placeholder={`Jumlah ${product.unit} yang ditambah`} value={qty} onChange={e => setQty(e.target.value)} required autoFocus />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Tambah Stok</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [restock, setRestock] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    setLoading(true)
    try { const res = await api.getProducts(search); setProducts(res.data) }
    catch { toast.error('Gagal memuat produk') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const handleDelete = async (id, name) => {
    if (!confirm(`Nonaktifkan produk "${name}"?`)) return
    try { await api.deleteProduct(id); toast.success('Produk dinonaktifkan'); load() }
    catch { toast.error('Gagal menghapus') }
  }

  const handleExport = async () => {
    try {
      const res = await api.exportProducts()
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'products.xlsx'; a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('Gagal export') }
  }

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        await api.importProducts(rows)
        toast.success(`${rows.length} produk diimport!`); load()
      } catch { toast.error('Gagal import') }
    }
    reader.readAsArrayBuffer(file); e.target.value = ''
  }

  const stockStatus = (p) => {
    if (p.stock_qty === 0) return { label: 'Habis', cls: 'bg-danger/20 text-danger' }
    if (p.stock_qty <= p.low_stock_alert) return { label: 'Rendah', cls: 'bg-warning/20 text-warning' }
    return { label: 'OK', cls: 'bg-success/20 text-success' }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal && <ProductModal product={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
      {restock && <RestockModal product={restock} onClose={() => setRestock(null)} onSaved={() => { setRestock(null); load() }} />}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Produk</h1>
          <p className="text-gray-400 text-sm">{products.length} produk terdaftar</p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current.click()} className="btn-secondary text-sm"><Upload className="w-4 h-4" /> Import</button>
          <button onClick={handleExport} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export</button>
          <button id="btn-add-product" onClick={() => setModal('add')} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Tambah</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-10" placeholder="Cari nama, ID produk..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrapper">
        <table className="w-full">
          <thead className="table-head">
            <tr>{['ID Produk','Nama','Harga','Satuan','Stok','Status','Aksi'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-gray-500">Memuat...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-gray-500">Belum ada produk</td></tr>
            ) : products.map(p => {
              const s = stockStatus(p)
              return (
                <tr key={p.product_id} className={`table-tr ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="table-td font-mono text-primary-400 text-xs">{p.product_id}</td>
                  <td className="table-td font-medium text-white">{p.name}</td>
                  <td className="table-td text-success font-semibold">{formatIDR(p.price)}</td>
                  <td className="table-td text-gray-400">{p.unit}</td>
                  <td className="table-td">
                    <span className="font-semibold text-white">{p.stock_qty}</span>
                    <span className="text-gray-500 text-xs ml-1">{p.unit}</span>
                  </td>
                  <td className="table-td">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button onClick={() => setRestock(p)} title="Tambah Stok" className="p-1.5 text-gray-400 hover:text-success hover:bg-success/10 rounded-lg transition-colors">
                        <Package className="w-4 h-4" />
                      </button>
                      <button id={`btn-edit-prod-${p.product_id}`} onClick={() => setModal(p)} className="p-1.5 text-gray-400 hover:text-primary-400 hover:bg-primary-600/10 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button id={`btn-del-prod-${p.product_id}`} onClick={() => handleDelete(p.product_id, p.name)} className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
