import axios from 'axios'

export const api = {
  // Auth
  login: (data) => axios.post('/auth/login', data),
  me: () => axios.get('/auth/me'),

  // Customers
  getCustomers: (search = '') => axios.get(`/customers?search=${search}`),
  getCustomer: (id) => axios.get(`/customers/${id}`),
  createCustomer: (data) => axios.post('/customers', data),
  updateCustomer: (id, data) => axios.put(`/customers/${id}`, data),
  deleteCustomer: (id) => axios.delete(`/customers/${id}`),
  exportCustomers: () => axios.get('/customers/export/xlsx', { responseType: 'blob' }),
  importCustomers: (rows) => axios.post('/customers/import', { rows }),

  // Products
  getProducts: (search = '') => axios.get(`/products?search=${search}`),
  getProduct: (id) => axios.get(`/products/${id}`),
  createProduct: (data) => axios.post('/products', data),
  updateProduct: (id, data) => axios.put(`/products/${id}`, data),
  restockProduct: (id, qty_add) => axios.put(`/products/${id}/restock`, { qty_add }),
  deleteProduct: (id) => axios.delete(`/products/${id}`),
  exportProducts: () => axios.get('/products/export/xlsx', { responseType: 'blob' }),
  importProducts: (rows) => axios.post('/products/import', { rows }),

  // Orders
  getOrders: (status = '') => axios.get(`/orders?status=${status}`),
  getOrder: (id) => axios.get(`/orders/${id}`),
  createOrder: (data) => axios.post('/orders', data),
  approveOrder: (id) => axios.put(`/orders/${id}/approve`),
  rejectOrder: (id, rejection_reason) => axios.put(`/orders/${id}/reject`, { rejection_reason }),

  // Invoices
  getInvoice: (invoiceId) => axios.get(`/invoices/${invoiceId}`),

  // Users
  getUsers: () => axios.get('/users'),
  createUser: (data) => axios.post('/users', data),
  updateUser: (id, data) => axios.put(`/users/${id}`, data),
  resetPassword: (id, new_password) => axios.put(`/users/${id}/password`, { new_password }),

  // Settings
  getSettings: () => axios.get('/settings'),
  updateSettings: (data) => axios.put('/settings', data),
  syncSheetsAll: () => axios.post('/settings/sheets/sync-all'),

  // Audit
  getAuditLog: (page = 1) => axios.get(`/audit?page=${page}&limit=50`),

  // Analytics
  getAnalytics: ({ from, to, group } = {}) => {
    const params = new URLSearchParams()
    if (from)  params.set('from', from)
    if (to)    params.set('to', to)
    if (group) params.set('group', group)
    return axios.get(`/analytics?${params.toString()}`)
  },
}
