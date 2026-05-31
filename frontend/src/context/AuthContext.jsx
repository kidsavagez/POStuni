import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

// API base URL. Override at build/deploy time with VITE_API_URL
// (e.g. "/api" when the backend is reverse-proxied on the same domain).
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4009/api'

// Auto-logout after this many minutes with no user activity.
// Change to 60 for a 1-hour timeout.
const INACTIVITY_MINUTES = 30
const INACTIVITY_LIMIT_MS = INACTIVITY_MINUTES * 60 * 1000
const LAST_ACTIVITY_KEY = 'lastActivity'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback((reason) => {
    localStorage.removeItem('token')
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
    if (reason) toast(reason, { icon: '🔒' })
  }, [])

  // Restore session on load (and ignore a stale session past the idle limit).
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }

    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0)
    if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
      // Idle too long since last visit — require a fresh login.
      logout()
      setLoading(false)
      return
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    axios.get('/auth/me')
      .then(res => setUser(res.data.user))   // API returns { user: {...} }
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  // Inactivity auto-logout: reset a timer on any user activity.
  useEffect(() => {
    if (!user) return

    let timer
    const reset = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      clearTimeout(timer)
      timer = setTimeout(
        () => logout(`Sesi berakhir setelah ${INACTIVITY_MINUTES} menit tidak ada aktivitas.`),
        INACTIVITY_LIMIT_MS
      )
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // start the countdown

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [user, logout])

  const login = async (email, password) => {
    const res = await axios.post('/auth/login', { email, password })
    const { token, user } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(user)
    return user
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
