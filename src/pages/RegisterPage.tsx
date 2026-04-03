import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { School, Classroom, GradeLevel } from '../types'

const GRADE_LEVELS: GradeLevel[] = ['ابتدائي', 'إعدادي', 'ثانوي']

const GRADE_NAMES: Record<GradeLevel, Record<number, string>> = {
  'ابتدائي': { 1:'أولى ابتدائي', 2:'تانية ابتدائي', 3:'تالتة ابتدائي', 4:'رابعة ابتدائي', 5:'خامسة ابتدائي', 6:'سادسة ابتدائي' },
  'إعدادي':  { 7:'أولى إعدادي', 8:'تانية إعدادي', 9:'تالتة إعدادي' },
  'ثانوي':   { 10:'أولى ثانوي', 11:'تانية ثانوي', 12:'تالتة ثانوي' },
}

const GRADE_RANGE: Record<GradeLevel, number[]> = {
  'ابتدائي': [1,2,3,4,5,6],
  'إعدادي':  [7,8,9],
  'ثانوي':   [10,11,12],
}

export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState({ username:'', full_name:'', password:'', confirm_password:'', grade_level:'' as GradeLevel|'', school_id:'', grade_num:0, classroom_id:'' })
  const [schools, setSchools] = useState<School[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [filteredClassrooms, setFilteredClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data }) => { if (data) setSchools(data) })
  }, [])

  useEffect(() => {
    if (!form.school_id) { setClassrooms([]); setForm(f => ({ ...f, classroom_id:'', grade_num:0 })); return }
    supabase.from('classrooms').select('*').eq('school_id', form.school_id).order('grade').order('section').then(({ data }) => { if (data) setClassrooms(data) })
  }, [form.school_id])

  useEffect(() => {
    if (!form.grade_num || !classrooms.length) { setFilteredClassrooms([]); setForm(f => ({ ...f, classroom_id:'' })); return }
    setFilteredClassrooms(classrooms.filter(c => c.grade === form.grade_num))
    setForm(f => ({ ...f, classroom_id:'' }))
  }, [form.grade_num, classrooms])

  useEffect(() => { setForm(f => ({ ...f, grade_num:0, classroom_id:'' })) }, [form.grade_level])

  const update = (field: string, value: string | number) => setForm(f => ({ ...f, [field]: value }))

  const validate = (): string | null => {
    if (!form.username.trim()) return 'اكتب اليوزر نيم'
    if (form.username.length < 3) return 'اليوزر نيم 3 حروف على الأقل'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'اليوزر نيم: حروف إنجليزية وأرقام فقط'
    if (!form.full_name.trim()) return 'اكتب اسمك بالكامل'
    if (!form.grade_level) return 'اختار مرحلتك الدراسية'
    if (!form.school_id) return 'اختار مدرستك'
    if (!form.grade_num) return 'اختار صفك الدراسي'
    if (!form.classroom_id) return 'اختار فصلك'
    if (form.password.length < 6) return 'كلمة المرور 6 أحرف على الأقل'
    if (form.password !== form.confirm_password) return 'كلمة المرور مش متطابقة'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError('')
    const { error: regError } = await register({ username: form.username, password: form.password, full_name: form.full_name, grade_level: form.grade_level, school_id: form.school_id, classroom_id: form.classroom_id })
    if (regError) { setError(regError); setLoading(false) } else { setSuccess(true) }
  }

  if (success) return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} className="glass rounded-2xl p-8 text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-green-400" /></div>
        <h2 className="text-2xl font-bold text-white mb-2">تم التسجيل! 🎉</h2>
        <p className="text-white/60 mb-6">تم إنشاء حسابك بنجاح. سجل دخولك الآن.</p>
        <Link to="/login" className="btn-primary inline-flex items-center gap-2"><span>تسجيل الدخول</span></Link>
      </motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4 py-10">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
      </div>
      <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white">إنشاء حساب جديد</h1>
          <p className="text-gold-400 mt-1">انضم لأولمبياد الرياضيات - فاقوس</p>
        </div>
        <div className="glass rounded-2xl p-8" style={{ boxShadow:'0 0 60px rgba(59,130,246,0.08)' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* يوزر نيم + اسم المستخدم */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-white/70 text-sm font-medium">يوزر نيم *</label>
                  <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">إنجليزي فقط</span>
                </div>
                <input type="text" value={form.username} onChange={e => update('username', e.target.value)} placeholder="ahmed123" className="input-dark" dir="ltr" />
                <p className="text-white/25 text-xs mt-1">بيتستخدم لتسجيل الدخول</p>
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">اسم المستخدم *</label>
                <input type="text" value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="أحمد محمد علي" className="input-dark" />
                <p className="text-white/25 text-xs mt-1">اسمك اللي هيظهر للكل</p>
              </div>
            </div>

            {/* المرحلة الدراسية */}
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">المرحلة الدراسية *</label>
              <div className="grid grid-cols-3 gap-2">
                {GRADE_LEVELS.map(g => (
                  <button key={g} type="button" onClick={() => update('grade_level', g)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${form.grade_level === g ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* المدرسة */}
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">المدرسة *</label>
              <div className="relative">
                <select value={form.school_id} onChange={e => update('school_id', e.target.value)} className="input-dark appearance-none cursor-pointer">
                  <option value="">اختار مدرستك...</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
              {schools.length === 0 && <p className="text-yellow-400/60 text-xs mt-1">⚠️ لا توجد مدارس متاحة، تواصل مع الإدارة</p>}
            </div>

            {/* الصف الدراسي */}
            {form.grade_level && form.school_id && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}>
                <label className="block text-white/70 text-sm font-medium mb-2">الصف الدراسي *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GRADE_RANGE[form.grade_level as GradeLevel]?.map(gradeNum => (
                    <button key={gradeNum} type="button" onClick={() => update('grade_num', gradeNum)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all border text-center ${form.grade_num === gradeNum ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'}`}>
                      {GRADE_NAMES[form.grade_level as GradeLevel]?.[gradeNum]}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* الفصل */}
            {form.grade_num > 0 && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}>
                <label className="block text-white/70 text-sm font-medium mb-2">الفصل *</label>
                {filteredClassrooms.length === 0 ? (
                  <p className="text-yellow-400/60 text-xs">⚠️ لا توجد فصول لهذا الصف، تواصل مع الإدارة</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredClassrooms.map(c => (
                      <button key={c.id} type="button" onClick={() => update('classroom_id', c.id)}
                        className={`w-14 py-2.5 rounded-xl text-sm font-bold transition-all border ${form.classroom_id === c.id ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}>
                        {c.section}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ملخص الاختيار */}
            {form.classroom_id && form.grade_level && form.grade_num > 0 && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
                ✅ {GRADE_NAMES[form.grade_level as GradeLevel]?.[form.grade_num]} — فصل {filteredClassrooms.find(c => c.id === form.classroom_id)?.section}
              </motion.div>
            )}

            {/* كلمة المرور */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">كلمة المرور *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" className="input-dark pl-10" dir="ltr" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">تأكيد كلمة المرور *</label>
                <input type="password" value={form.confirm_password} onChange={e => update('confirm_password', e.target.value)} placeholder="••••••••" className="input-dark" dir="ltr" />
              </div>
            </div>

            {/* خطأ */}
            {error && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertCircle size={16} /><span>{error}</span>
              </motion.div>
            )}

            <motion.button type="submit" disabled={loading} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} className="btn-primary flex items-center justify-center gap-2 w-full mt-2 disabled:opacity-50">
              {loading ? <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <><UserPlus size={18} /><span>إنشاء الحساب</span></>}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/40 text-sm">عندك حساب؟{' '}<Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">سجل دخولك</Link></p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
