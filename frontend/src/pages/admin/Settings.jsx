import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Settings, Save, Bot, Building2, CreditCard, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

const SECTION_TABS = [
  { key: 'company',  label: 'Profil Perusahaan', icon: Building2 },
  { key: 'id',       label: 'Format ID',          icon: Hash },
  { key: 'tax',      label: 'Pajak & Invoice',    icon: CreditCard },
  { key: 'telegram', label: 'Telegram Bot',       icon: Bot },
]

// Defined at module scope (not inside SettingsPage) so its identity is stable
// across renders. A component re-created every render makes React remount the
// <input> on each keystroke, which resets the caret to the end.
function Field({ label, skey, type = 'text', placeholder = '', hint = '', settings, update }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={settings[skey] || ''}
        onChange={e => update(skey, e.target.value)}
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('company')

  useEffect(() => {
    api.getSettings()
      .then(res => setSettings(res.data))
      .catch(() => toast.error('Gagal memuat pengaturan'))
      .finally(() => setLoading(false))
  }, [])

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateSettings(settings)
      toast.success('Pengaturan disimpan!')
    } catch { toast.error('Gagal menyimpan pengaturan') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-primary-400" /> Pengaturan</h1>
          <p className="text-gray-400 text-sm">Konfigurasi sistem dan perusahaan</p>
        </div>
        <button id="btn-save-settings" onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Simpan</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {SECTION_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-surface-hover text-gray-400 hover:text-white border border-surface-border'}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card space-y-4">
        {tab === 'company' && <>
          <h3 className="font-semibold text-white border-b border-surface-border pb-3">Identitas Perusahaan</h3>
          <p className="text-xs text-gray-500 bg-info/10 border border-info/20 rounded-lg p-3 text-info">
            ℹ️ Data ini akan tampil di invoice. Isi dengan data perusahaan Anda setelah aplikasi diterima.
          </p>
          <Field label="Nama Perusahaan" skey="company_name" placeholder="PT. Nama Perusahaan Anda" settings={settings} update={update} />
          <div>
            <label className="label">Alamat Perusahaan</label>
            <textarea className="input resize-none h-20" placeholder="Jl. Alamat No. 1, Kota, Provinsi" value={settings.company_address || ''} onChange={e => update('company_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telepon" skey="company_phone" placeholder="+62 812-xxx-xxxx" settings={settings} update={update} />
            <Field label="Email" skey="company_email" type="email" placeholder="email@perusahaan.com" settings={settings} update={update} />
          </div>
          <Field label="URL Logo" skey="company_logo_url" placeholder="https://..." hint="URL gambar logo perusahaan (PNG/JPG)" settings={settings} update={update} />
        </>}

        {tab === 'id' && <>
          <h3 className="font-semibold text-white border-b border-surface-border pb-3">Format Auto-ID</h3>
          <p className="text-xs text-gray-500 bg-warning/10 border border-warning/20 rounded-lg p-3 text-warning">
            ⚠️ Perubahan format ID hanya berlaku untuk record baru. ID yang sudah ada tidak berubah.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prefix Pelanggan" skey="customer_id_prefix" placeholder="CUST" settings={settings} update={update} />
            <Field label="Padding Pelanggan" skey="customer_id_padding" type="number" placeholder="4" hint="Contoh: 4 → CUST-0001" settings={settings} update={update} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prefix Produk" skey="product_id_prefix" placeholder="PRD" settings={settings} update={update} />
            <Field label="Padding Produk" skey="product_id_padding" type="number" placeholder="4" hint="Contoh: 4 → PRD-0001" settings={settings} update={update} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format Order ID" skey="order_id_format" placeholder="ORD-{DATE}-{SEQ}" hint="{DATE}=tanggal, {SEQ}=urutan" settings={settings} update={update} />
            <Field label="Padding Urutan Order" skey="order_seq_padding" type="number" placeholder="3" settings={settings} update={update} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format Invoice ID" skey="invoice_id_format" placeholder="INV-{DATE}-{SEQ}" settings={settings} update={update} />
            <Field label="Padding Urutan Invoice" skey="invoice_seq_padding" type="number" placeholder="3" settings={settings} update={update} />
          </div>
        </>}

        {tab === 'tax' && <>
          <h3 className="font-semibold text-white border-b border-surface-border pb-3">Pajak & Informasi Bank</h3>
          <Field label="Tarif PPN Default (%)" skey="default_tax_rate" type="number" placeholder="11" hint="Contoh: 11 untuk PPN 11%" settings={settings} update={update} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama Bank" skey="bank_name" placeholder="Bank BCA" settings={settings} update={update} />
            <Field label="Nomor Rekening" skey="bank_account" placeholder="1234567890" settings={settings} update={update} />
          </div>
          <Field label="Nama Pemilik Rekening" skey="bank_holder" placeholder="PT. Nama Perusahaan" settings={settings} update={update} />
        </>}

        {tab === 'telegram' && <>
          <h3 className="font-semibold text-white border-b border-surface-border pb-3">Konfigurasi Telegram Bot</h3>
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 space-y-2">
            <p className="text-info text-sm font-semibold">📱 Cara Setup Telegram Bot:</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Buka Telegram, cari <span className="text-white font-mono">@BotFather</span></li>
              <li>Kirim <span className="text-white font-mono">/newbot</span> dan ikuti instruksi</li>
              <li>Salin <strong className="text-white">Bot Token</strong> yang diberikan BotFather</li>
              <li>Cari <span className="text-white font-mono">@userinfobot</span>, kirim pesan untuk mendapatkan <strong className="text-white">Chat ID</strong> Anda</li>
              <li>Isi kedua field di bawah ini dan simpan</li>
            </ol>
          </div>
          <Field label="Bot Token" skey="telegram_bot_token" placeholder="123456789:ABC-DEF..." hint="Token dari @BotFather" settings={settings} update={update} />
          <Field label="Admin Chat ID" skey="telegram_admin_chat_id" placeholder="123456789" hint="Chat ID Telegram admin (dari @userinfobot)" settings={settings} update={update} />
        </>}
      </div>
    </div>
  )
}
