import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, Package } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Selamat datang, ${user.name}!`)
      navigate(user.role === 'admin' ? '/admin' : '/sales')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login gagal. Periksa email dan password Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-surface">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay:'1s'}} />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">
        <div className="glass border border-surface-border rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary-900/50">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">TuniOrder</h1>
            <p className="text-gray-400 text-sm mt-1">Sales Order Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="email@perusahaan.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-5 h-5" /> Masuk</>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Default admin: <span className="text-gray-300">admin@tuni.com</span> / <span className="text-gray-300">Admin@123</span>
          </p>
        </div>
      </div>
    </div>
  )
}
