import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatDateTime } from '../../utils/helpers'
import { Plus, Edit2, X, Check, UserCheck, UserX, Key } from 'lucide-react'
import toast from 'react-hot-toast'

function AccountModal({ account, onClose, onSaved }) {
  const [form, setForm] = useState(account || { name: '', email: '', password: '', telegram_chat_id: '' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!account?.user_id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) await api.updateUser(account.user_id, { name: form.name, telegram_chat_id: form.telegram_chat_id })
      else await api.createUser(form)
      toast.success(isEdit ? 'Akun diperbarui!' : 'Akun Sales dibuat!')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit Akun' : 'Buat Akun Sales'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nama Lengkap *</label>
            <input className="input" placeholder="Nama sales" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          {!isEdit && <>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" placeholder="email@sales.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" placeholder="Min. 6 karakter" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
          </>}
          <div>
            <label className="label">Telegram Chat ID <span className="text-gray-500">(opsional)</span></label>
            <input className="input" placeholder="Contoh: 123456789" value={form.telegram_chat_id} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })} />
            <p className="text-xs text-gray-500 mt-1">Chat @userinfobot di Telegram untuk mendapatkan ID</p>
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

export default function Accounts() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try { const res = await api.getUsers(); setUsers(res.data) }
    catch { toast.error('Gagal memuat akun') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (u) => {
    try {
      await api.updateUser(u.user_id, { is_active: u.is_active ? 0 : 1 })
      toast.success(`Akun ${u.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      load()
    } catch { toast.error('Gagal mengubah status') }
  }

  const handleResetPw = async (u) => {
    const pw = prompt(`Reset password untuk ${u.name}:\nPassword baru:`)
    if (!pw?.trim() || pw.length < 6) { if (pw !== null) toast.error('Password min. 6 karakter'); return }
    try { await api.resetPassword(u.user_id, pw); toast.success('Password direset!') }
    catch { toast.error('Gagal reset password') }
  }

  const salesUsers = users.filter(u => u.role === 'sales')

  return (
    <div className="space-y-5 animate-fade-in">
      {modal && <AccountModal account={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Akun Sales</h1>
          <p className="text-gray-400 text-sm">{salesUsers.length} akun sales</p>
        </div>
        <button id="btn-add-sales" onClick={() => setModal('add')} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Buat Akun Sales
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm col-span-full text-center py-8">Memuat...</p>
        ) : salesUsers.length === 0 ? (
          <p className="text-gray-500 text-sm col-span-full text-center py-8">Belum ada akun sales. Klik "Buat Akun Sales" untuk memulai.</p>
        ) : salesUsers.map(u => (
          <div key={u.user_id} className={`card ${!u.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${u.is_active ? 'gradient-primary' : 'bg-surface-border'}`}>
                  {u.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{u.name}</p>
                  <p className="text-xs text-primary-400 font-mono">{u.user_id}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? 'bg-success/20 text-success' : 'bg-surface-border text-gray-500'}`}>
                {u.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm mb-4">
              <p className="text-gray-400">{u.email}</p>
              <p className="text-gray-500 text-xs">Telegram: {u.telegram_chat_id || 'Belum diset'}</p>
              <p className="text-gray-500 text-xs">Bergabung: {formatDateTime(u.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(u)} className="btn-secondary text-xs flex-1 justify-center py-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => handleResetPw(u)} className="btn-secondary text-xs py-1.5 px-3" title="Reset Password">
                <Key className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleToggle(u)}
                className={`text-xs py-1.5 px-3 rounded-lg border transition-all duration-200 ${u.is_active ? 'text-danger border-danger/30 hover:bg-danger/10' : 'text-success border-success/30 hover:bg-success/10'}`}
                title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              >
                {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
