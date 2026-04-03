import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ error: string | null }>
  register: (data: RegisterData) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

interface RegisterData {
  username: string
  password: string
  full_name: string
  grade_level: string
  school_id: string
  classroom_id: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        school:schools(id, name),
        classroom:classrooms(id, grade, section, name)
      `)
      .eq('id', userId)
      .single()

    if (!error && data) {
      setProfile(data as Profile)
    }
    setLoading(false)
  }

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id)
        fetchProfile(session.user.id)
      } else {
        setCurrentUserId(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ✅ Real-time: لو الأدمن غيّر الـ role تتغير الشاشة فوراً
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`profile-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        () => {
          // إعادة تحميل الـ profile عشان يجيب الـ role الجديد
          fetchProfile(currentUserId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const login = async (username: string, password: string): Promise<{ error: string | null }> => {
    // Username → email mapping: username@faqous.local
    const email = `${username.toLowerCase().trim()}@faqous.local`

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.includes('Invalid login')) return { error: 'اسم المستخدم أو كلمة المرور غلط' }
      if (error.message.includes('Email not confirmed')) return { error: 'الحساب لم يتم تفعيله بعد' }
      return { error: 'حصل خطأ، حاول تاني' }
    }
    return { error: null }
  }

  const register = async (data: RegisterData): Promise<{ error: string | null }> => {
    const email = `${data.username.toLowerCase().trim()}@faqous.local`

    // Check if username already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', data.username.toLowerCase().trim())
      .single()

    if (existing) return { error: 'اسم المستخدم ده موجود قبل كده' }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: { username: data.username },
        emailRedirectTo: undefined,
      },
    })

    if (authError) {
      if (authError.message.includes('already registered')) return { error: 'اسم المستخدم موجود قبل كده' }
      return { error: authError.message }
    }

    if (!authData.user) return { error: 'حصل خطأ في إنشاء الحساب' }

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username: data.username.toLowerCase().trim(),
      full_name: data.full_name,
      role: 'student',
      grade_level: data.grade_level,
      school_id: data.school_id || null,
      classroom_id: data.classroom_id || null,
      is_active: true,
    })

    if (profileError) return { error: 'حصل خطأ في حفظ البيانات' }

    return { error: null }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
