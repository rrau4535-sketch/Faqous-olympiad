import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, LayoutDashboard, Home, Menu, X, Trophy } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Navbar() {
  const { profile, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  const navLinks = isAdmin
    ? [{ to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard }]
    : [
        { to: '/', label: 'الأسئلة', icon: Home },
        { to: '/profile', label: 'بروفايلي', icon: User },
      ]

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center">
              <Trophy size={20} className="text-gold-400" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white font-bold text-sm leading-tight">أولمبياد الرياضيات</p>
              <p className="text-gold-400 text-xs font-semibold">فاقوس</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === to
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>

          {/* User info + Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 glass px-3 py-1.5 rounded-xl">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isAdmin ? 'bg-gold-400' : 'bg-green-400'
              }`} />
              <span className="text-white/80 text-sm font-medium">{profile?.username}</span>
              {isAdmin && (
                <span className="text-gold-400 text-xs bg-gold-500/10 px-2 py-0.5 rounded-full border border-gold-500/20">
                  {profile?.role === 'superadmin' ? 'سوبر أدمن' : 'أدمن'}
                </span>
              )}
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">خروج</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden pb-4 overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-2">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === to
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
                <div className="flex items-center gap-2 px-4 py-2 text-white/50 text-sm">
                  <span>مسجل بـ:</span>
                  <span className="text-white font-medium">{profile?.username}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
