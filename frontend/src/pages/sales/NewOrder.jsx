import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { formatIDR, calcOrderTotals } from '../../utils/helpers'
import { Search, Plus, Trash2, Send, User, Package, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import debounce from 'lodash.debounce'

function SearchDropdown({ placeholder, onSearch, onSelect, renderItem, displayValue, icon: Icon }) {
  const [query, setQuery] = useState(displayValue || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(debounce(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try { const res = await onSearch(q); setResults(res) }
    catch { setResults([]) }
    finally { setLoading(false) }
  }, 300), [onSearch])

  useEffect(() => { doSearch(query) }, [query])
  useEffect(() => { setQuery(displayValue || '') }, [displayValue])

  return (
    <div className="relative">
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
        <input
          className={`input ${Icon ? 'pl-10' : ''}`}
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border border-primary-400 border-t-transparent rounded-full animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-surface-card border border-surface-border rounded-xl shadow-xl overflow-hidden animate-slide-up max-h-56 overflow-y-auto">
          {results.map((item, i) => (
            <div
              key={i}
              className="px-4 py-3 hover:bg-surface-hover cursor-pointer transition-colors border-b border-surface-border last:border-0"
              onMouseDown={() => { onSelect(item); setQuery(''); setOpen(false); setResults([]) }}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewOrder() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [discountGlobal, setDiscountGlobal] = useState(0)
  const [taxRate, setTaxRate] = useState(11)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load default tax rate
  useEffect(() => {
    api.getSettings().then(res => setTaxRate(Number(res.data.default_tax_rate) || 11)).catch(() => {})
  }, [])

  const searchCustomers = async (q) => {
    const res = await api.getCustomers(q)
    return res.data
  }

  const searchProducts = async (q) => {
    const res = await api.getProducts(q)
    return res.data.filter(p => p.is_active && p.stock_qty > 0)
  }

  const addItem = (product) => {
    if (items.find(i => i.product_id === product.product_id)) {
      toast('Produk sudah ada di daftar. Ubah qty-nya.', { icon: 'ℹ️' })
      return
    }
    setItems(prev => [...prev, {
      product_id: product.product_id,
      product_name: product.name,
      unit: product.unit,
      unit_price: product.price,
      max_stock: product.stock_qty,
      qty: 1,
      discount_pct: 0,
    }])
  }

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totals = calcOrderTotals(items, discountGlobal, taxRate)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customer) { toast.error('Pilih pelanggan terlebih dahulu'); return }
    if (items.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    for (const item of items) {
      if (item.qty <= 0) { toast.error(`Qty ${item.product_name} harus lebih dari 0`); return }
      if (item.qty > item.max_stock) { toast.error(`Stok ${item.product_name} tidak cukup (tersisa ${item.max_stock})`); return }
    }
    setSubmitting(true)
    try {
      const res = await api.createOrder({
        customer_id: customer.customer_id,
        items: items.map(it => ({
          product_id: it.product_id,
          qty: Number(it.qty),
          unit_price: it.unit_price,
          discount_pct: Number(it.discount_pct),
        })),
        discount_global: Number(discountGlobal),
        tax_rate: Number(taxRate),
        note,
      })
      toast.success(`✅ Pesanan ${res.data.order_id} berhasil dikirim! Menunggu persetujuan admin.`)
      navigate('/sales/orders')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat pesanan')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Buat Pesanan Baru</h1>
        <p className="text-gray-400 text-sm">Cari pelanggan, tambahkan produk, dan kirim pesanan</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1 — Customer */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 gradient-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            Pilih Pelanggan
          </h2>
          {customer ? (
            <div className="flex items-center justify-between p-3 bg-primary-600/10 border border-primary-600/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {customer.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white">{customer.name}</p>
                  <p className="text-xs text-primary-400 font-mono">{customer.customer_id}</p>
                  {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
                </div>
              </div>
              <button type="button" onClick={() => setCustomer(null)} className="text-gray-400 hover:text-danger transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <SearchDropdown
              placeholder="Cari nama atau ID pelanggan..."
              onSearch={searchCustomers}
              onSelect={setCustomer}
              icon={User}
              renderItem={c => (
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.customer_id} • {c.phone}</p>
                </div>
              )}
            />
          )}
        </div>

        {/* Step 2 — Products */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 gradient-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            Tambah Produk
          </h2>
          <SearchDropdown
            placeholder="Cari nama atau ID produk..."
            onSearch={searchProducts}
            onSelect={addItem}
            icon={Package}
            renderItem={p => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.product_id} • Stok: {p.stock_qty} {p.unit}</p>
                </div>
                <span className="text-success text-sm font-semibold">{formatIDR(p.price)}</span>
              </div>
            )}
          />

          {items.length > 0 && (
            <div className="mt-4 space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-surface rounded-xl border border-surface-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-white text-sm">{item.product_name}</p>
                      <p className="text-xs text-primary-400">{item.product_id} • {formatIDR(item.unit_price)}/{item.unit}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-danger transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Qty ({item.unit})</label>
                      <input
                        type="number"
                        min="1"
                        max={item.max_stock}
                        className="input text-sm py-1.5"
                        value={item.qty}
                        onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Diskon (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input text-sm py-1.5"
                        value={item.discount_pct}
                        onChange={e => updateItem(idx, 'discount_pct', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Subtotal</label>
                      <p className="text-success font-semibold text-sm py-1.5">
                        {formatIDR(item.qty * item.unit_price * (1 - item.discount_pct / 100))}
                      </p>
                    </div>
                  </div>
                  {item.qty > item.max_stock && (
                    <p className="text-danger text-xs mt-2">⚠️ Melebihi stok tersedia ({item.max_stock} {item.unit})</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3 — Review */}
        {items.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 gradient-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Ringkasan & Kirim
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Diskon Global (%)</label>
                <input type="number" min="0" max="100" className="input text-sm" value={discountGlobal} onChange={e => setDiscountGlobal(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">PPN (%)</label>
                <input type="number" min="0" max="100" className="input text-sm" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-surface rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white font-medium">{formatIDR(totals.subtotal)}</span>
              </div>
              {discountGlobal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Diskon Global ({discountGlobal}%)</span>
                  <span className="text-danger font-medium">- {formatIDR(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">PPN ({taxRate}%)</span>
                <span className="text-gray-300">{formatIDR(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-surface-border">
                <span className="font-bold text-white">TOTAL</span>
                <span className="font-bold text-primary-400 text-lg">{formatIDR(totals.total)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Catatan untuk Admin <span className="text-gray-500">(opsional)</span></label>
              <textarea
                className="input resize-none h-16"
                placeholder="Contoh: Mohon segera diproses, pengiriman urgent"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <button
              id="btn-submit-order"
              type="submit"
              disabled={submitting || !customer}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Send className="w-5 h-5" /> Kirim Pesanan</>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
