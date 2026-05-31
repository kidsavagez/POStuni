import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { formatIDR, formatDate, formatDateTime } from '../../utils/helpers'
import { Printer, Download, ArrowLeft, CheckCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'

export default function InvoicePage() {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  useEffect(() => {
    api.getInvoice(invoiceId)
      .then(res => setData(res.data))
      .catch(() => toast.error('Invoice tidak ditemukan'))
      .finally(() => setLoading(false))
  }, [invoiceId])

  const handlePrint = () => window.print()

  const handlePDF = async () => {
    toast.loading('Membuat PDF...')
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = (canvas.height * pageW) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
      pdf.save(`${invoiceId}.pdf`)
      toast.dismiss()
      toast.success('PDF berhasil diunduh!')
    } catch {
      toast.dismiss()
      toast.error('Gagal membuat PDF')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return (
    <div className="card text-center py-12">
      <p className="text-gray-400">Invoice tidak ditemukan</p>
      <button onClick={() => navigate('/sales/orders')} className="btn-secondary mt-4 inline-flex">← Kembali</button>
    </div>
  )

  const { invoice, order, customer, items, settings } = data

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Action Bar */}
      <div className="no-print flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/sales/orders')} className="btn-secondary text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="ml-auto flex gap-2">
          <button id="btn-download-pdf" onClick={handlePDF} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Unduh PDF
          </button>
          <button id="btn-print-invoice" onClick={handlePrint} className="btn-primary text-sm">
            <Printer className="w-4 h-4" /> Cetak
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div
        ref={printRef}
        className="print-invoice bg-white text-gray-900 rounded-2xl shadow-xl overflow-hidden max-w-2xl mx-auto"
        style={{ fontFamily: 'Inter, Arial, sans-serif' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '32px 40px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              {settings?.company_logo_url && (
                <img src={settings.company_logo_url} alt="Logo" style={{ height: '48px', marginBottom: '8px', objectFit: 'contain' }} />
              )}
              <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>{settings?.company_name || 'PT. Nama Perusahaan'}</h1>
              <p style={{ fontSize: '12px', opacity: 0.85, margin: 0, maxWidth: '260px' }}>{settings?.company_address}</p>
              <p style={{ fontSize: '12px', opacity: 0.85, margin: '4px 0 0' }}>{settings?.company_phone} | {settings?.company_email}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', opacity: 0.8, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Invoice</p>
              <p style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px', fontFamily: 'monospace' }}>{invoice.invoice_id}</p>
              <p style={{ fontSize: '11px', opacity: 0.8, margin: 0 }}>Tanggal: {formatDate(invoice.issued_at)}</p>
              <p style={{ fontSize: '11px', opacity: 0.8, margin: '2px 0 0' }}>Pesanan: {order.order_id}</p>
              <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 10px', display: 'inline-block' }}>
                <span style={{ fontSize: '11px', fontWeight: '700' }}>✅ LUNAS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div style={{ padding: '24px 40px', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: '600' }}>Kepada</p>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 2px' }}>{customer.name}</p>
            <p style={{ fontSize: '12px', color: '#4b5563', margin: '0 0 2px' }}>{customer.address || '-'}</p>
            <p style={{ fontSize: '12px', color: '#4b5563', margin: 0 }}>{customer.phone}</p>
            {customer.email && <p style={{ fontSize: '12px', color: '#4b5563', margin: '2px 0 0' }}>{customer.email}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: '600' }}>Detail Pembayaran</p>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 2px' }}>{settings?.bank_name}</p>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#111827', fontFamily: 'monospace', margin: '0 0 2px' }}>{settings?.bank_account}</p>
            <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>a/n {settings?.bank_holder}</p>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '24px 40px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb' }}>Produk</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb' }}>Harga</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb' }}>Diskon</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e5e7eb' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', color: '#111827', fontWeight: '500' }}>{item.product_name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}>{item.qty}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{formatIDR(item.unit_price)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: item.discount_pct > 0 ? '#ef4444' : '#9ca3af' }}>
                    {item.discount_pct > 0 ? `${item.discount_pct}%` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>{formatIDR(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: '0 40px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span style={{ color: '#374151' }}>{formatIDR(order.subtotal)}</span>
            </div>
            {order.discount_global > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>Diskon Global ({order.discount_global}%)</span>
                <span style={{ color: '#ef4444' }}>- {formatIDR(order.discount_amount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>PPN ({order.tax_rate}%)</span>
              <span style={{ color: '#374151' }}>{formatIDR(order.tax_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', borderTop: '2px solid #111827', marginTop: '4px' }}>
              <span style={{ fontWeight: '800', fontSize: '15px', color: '#111827' }}>TOTAL</span>
              <span style={{ fontWeight: '800', fontSize: '17px', color: '#4f46e5' }}>{formatIDR(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f9fafb', padding: '20px 40px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px' }}>Dicetak: {formatDateTime(new Date().toISOString())}</p>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Terima kasih atas kepercayaan Anda!</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '120px', borderTop: '1px solid #374151', paddingTop: '6px', marginTop: '40px' }}>
              <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>Tanda Tangan</p>
              <p style={{ fontSize: '11px', color: '#374151', margin: '2px 0 0', fontWeight: '600' }}>{settings?.company_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
