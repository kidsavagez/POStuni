import { useEffect, useState, useRef } from 'react'
import { api } from '../../api'
import { formatDateTime } from '../../utils/helpers'
import { Plus, Search, Edit2, Trash2, Upload, Download, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

function CustomerModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(customer || { name: '', email: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!customer?.customer_id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) await api.updateCustomer(customer.customer_id, form)
      else await api.createCustomer(form)
      toast.success(isEdit ? 'Pelanggan diperbarui!' : 'Pelanggan ditambahkan!')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { key: 'name', label: 'Nama *', placeholder: 'PT. Nama Pelanggan', required: true },
            { key: 'email', label: 'Email', placeholder: 'email@pelanggan.com' },
            { key: 'phone', label: 'Telepon', placeholder: '+62 812-xxx-xxxx' },
            { key: 'address', label: 'Alamat', placeholder: 'Jl. Alamat No. 1, Kota' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.key === 'address' ? (
                <textarea
                  className="input resize-none h-20"
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  required={f.required}
                />
              )}
            </div>
          ))}
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

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | customer_obj
  const fileRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.getCustomers(search)
      setCustomers(res.data)
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus pelanggan "${name}"?`)) return
    try {
      await api.deleteCustomer(id)
      toast.success('Pelanggan dihapus')
      load()
    } catch { toast.error('Gagal menghapus') }
  }

  const handleExport = async () => {
    try {
      const res = await api.exportCustomers()
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'customers.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Gagal export') }
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        await api.importCustomers(rows)
        toast.success(`${rows.length} pelanggan diimport!`)
        load()
      } catch { toast.error('Gagal import file') }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal && (
        <CustomerModal
          customer={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Pelanggan</h1>
          <p className="text-gray-400 text-sm">{customers.length} pelanggan terdaftar</p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current.click()} className="btn-secondary text-sm">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button id="btn-add-customer" onClick={() => setModal('add')} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Tambah
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-10"
          placeholder="Cari nama, ID, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="w-full">
          <thead className="table-head">
            <tr>
              {['ID Pelanggan','Nama','Email','Telepon','Alamat','Dibuat','Aksi'].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-gray-500">Memuat...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-gray-500">Belum ada pelanggan</td></tr>
            ) : customers.map(c => (
              <tr key={c.customer_id} className="table-tr">
                <td className="table-td font-mono text-primary-400 text-xs">{c.customer_id}</td>
                <td className="table-td font-medium text-white">{c.name}</td>
                <td className="table-td text-gray-400">{c.email || '-'}</td>
                <td className="table-td text-gray-400">{c.phone || '-'}</td>
                <td className="table-td text-gray-400 max-w-xs truncate">{c.address || '-'}</td>
                <td className="table-td text-gray-500 text-xs">{formatDateTime(c.created_at)}</td>
                <td className="table-td">
                  <div className="flex gap-2">
                    <button
                      id={`btn-edit-cust-${c.customer_id}`}
                      onClick={() => setModal(c)}
                      className="p-1.5 text-gray-400 hover:text-primary-400 hover:bg-primary-600/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      id={`btn-del-cust-${c.customer_id}`}
                      onClick={() => handleDelete(c.customer_id, c.name)}
                      className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
