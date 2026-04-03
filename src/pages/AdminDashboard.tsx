import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, HelpCircle, School, Trophy,
  Plus, Trash2, Edit3, Eye, EyeOff, CheckCircle, XCircle,
  Clock, BarChart3, Send, ChevronDown, ChevronUp, X,
  RefreshCw, AlertCircle, Zap, Crown, Shield
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/shared/Navbar'
import type { Profile, Question, Choice, School as SchoolType, Classroom, Answer } from '../types'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface QuestionForm {
  text: string
  time_limit: number
  target_type: 'all' | 'grade' | 'school'
  target_grade: string
  target_school_id: string
  choices: { text: string; is_correct: boolean }[]
}

interface AnswerWithUser extends Answer {
  profile: { username: string; full_name?: string; school?: { name: string }; classroom?: { name: string } }
  choice: { text: string; is_correct: boolean }
}

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'questions', label: 'الأسئلة', icon: HelpCircle },
  { id: 'schools', label: 'المدارس', icon: School },
  { id: 'users', label: 'الطلاب', icon: Users },
  { id: 'leaderboard', label: 'الترتيب', icon: Trophy },
]

const defaultForm: QuestionForm = {
  text: '',
  time_limit: 300,
  target_type: 'all',
  target_grade: '',
  target_school_id: '',
  choices: [
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('overview')
  const isSuperAdmin = profile?.role === 'superadmin'

  // ── Data State ──
  const [stats, setStats] = useState({ users: 0, questions: 0, answers: 0, correct: 0 })
  const [questions, setQuestions] = useState<Question[]>([])
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [leaderboard, setLeaderboard] = useState<{ profile: Profile; correct: number; total: number; first_at?: string }[]>([])
  const [loading, setLoading] = useState(false)

  // ── Question Form ──
  const [showQForm, setShowQForm] = useState(false)
  const [qForm, setQForm] = useState<QuestionForm>(defaultForm)
  const [savingQ, setSavingQ] = useState(false)
  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [qAnswers, setQAnswers] = useState<Record<string, AnswerWithUser[]>>({})

  // ── School Form ──
  const [schoolName, setSchoolName] = useState('')
  const [classroomConfig, setClassroomConfig] = useState<Record<string, { grade: string; count: string }[]>>({})
  const [savingSchool, setSavingSchool] = useState(false)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

  // ── Load data based on tab ──
  const loadData = useCallback(async () => {
    setLoading(true)
    if (tab === 'overview' || tab === 'leaderboard') {
      const [{ count: userCount }, { count: qCount }, { data: ansData }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('answers').select('user_id, is_correct'),
      ])
      const correct = ansData?.filter((a: { is_correct: boolean }) => a.is_correct).length ?? 0
      setStats({ users: userCount ?? 0, questions: qCount ?? 0, answers: ansData?.length ?? 0, correct })
    }

    if (tab === 'questions') {
      const { data } = await supabase
        .from('questions')
        .select('*, choices(*)')
        .order('created_at', { ascending: false })
      setQuestions(data ?? [])
    }

    if (tab === 'schools') {
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('classrooms').select('*, school:schools(name)').order('grade').order('section'),
      ])
      setSchools(s ?? [])
      setClassrooms(c ?? [])
    }

    if (tab === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('*, school:schools(name), classroom:classrooms(name)')
        .order('created_at', { ascending: false })
      setUsers(data ?? [])
    }

    if (tab === 'leaderboard') {
      const { data: ansData } = await supabase
        .from('answers')
        .select('user_id, is_correct, answered_at, question_id')

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*, school:schools(name), classroom:classrooms(name)')
        .eq('role', 'student')

      if (ansData && profiles) {
        const scoreMap: Record<string, { correct: number; total: number; first_at?: string }> = {}
        ansData.forEach((a: { user_id: string; is_correct: boolean; answered_at: string }) => {
          if (!scoreMap[a.user_id]) scoreMap[a.user_id] = { correct: 0, total: 0 }
          scoreMap[a.user_id].total++
          if (a.is_correct) scoreMap[a.user_id].correct++
          if (!scoreMap[a.user_id].first_at || a.answered_at < scoreMap[a.user_id].first_at!) {
            scoreMap[a.user_id].first_at = a.answered_at
          }
        })

        const ranked = profiles
          .map((p: Profile) => ({ profile: p, ...( scoreMap[p.id] || { correct: 0, total: 0 }) }))
          .sort((a, b) => b.correct - a.correct || (a.first_at || '').localeCompare(b.first_at || ''))

        setLeaderboard(ranked)
      }
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { loadData() }, [loadData])

  // Real-time answers
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  // ── Load answers for expanded question ──
  const loadQuestionAnswers = async (qId: string) => {
    const { data } = await supabase
      .from('answers')
      .select(`
        *,
        profile:profiles(username, full_name, school:schools(name), classroom:classrooms(name)),
        choice:choices(text, is_correct)
      `)
      .eq('question_id', qId)
      .order('answered_at', { ascending: true })
    setQAnswers(prev => ({ ...prev, [qId]: data ?? [] }))
  }

  // ── Save Question ──
  const saveQuestion = async () => {
    if (!qForm.text.trim()) return alert('اكتب نص السؤال')
    const validChoices = qForm.choices.filter(c => c.text.trim())
    if (validChoices.length < 2) return alert('أضف اختيارين على الأقل')
    if (!validChoices.some(c => c.is_correct)) return alert('حدد الإجابة الصحيحة')

    setSavingQ(true)
    const { data: q, error } = await supabase.from('questions').insert({
      text: qForm.text,
      time_limit: qForm.time_limit,
      target_type: qForm.target_type,
      target_grade: qForm.target_type === 'grade' ? qForm.target_grade : null,
      target_school_id: qForm.target_type === 'school' ? qForm.target_school_id : null,
      is_published: false,
      created_by: profile!.id,
    }).select().single()

    if (!error && q) {
      await supabase.from('choices').insert(
        validChoices.map((c, i) => ({
          question_id: q.id,
          text: c.text,
          is_correct: c.is_correct,
          order_num: i,
        }))
      )
      setShowQForm(false)
      setQForm(defaultForm)
      loadData()
    }
    setSavingQ(false)
  }

  // ── Publish / Unpublish Question ──
  const togglePublish = async (q: Question) => {
    const updates = q.is_published
      ? { is_published: false, published_at: null }
      : { is_published: true, published_at: new Date().toISOString() }
    await supabase.from('questions').update(updates).eq('id', q.id)
    loadData()
  }

  // ── Delete Question ──
  const deleteQuestion = async (id: string) => {
    if (!confirm('مؤكد تحذف السؤال ده؟')) return
    await supabase.from('questions').delete().eq('id', id)
    loadData()
  }

  // ── Add School ──
  const addSchool = async () => {
    if (!schoolName.trim()) return
    setSavingSchool(true)
    const { data: s } = await supabase.from('schools').insert({ name: schoolName }).select().single()
    if (s) {
      setClassroomConfig(prev => ({ ...prev, [s.id]: [{ grade: '1', count: '1' }] }))
      setSchoolName('')
      loadData()
    }
    setSavingSchool(false)
  }

  // ── Generate Classrooms ──
  const generateClassrooms = async (schoolId: string) => {
    const configs = classroomConfig[schoolId] || []
    const inserts = []
    for (const cfg of configs) {
      const count = parseInt(cfg.count) || 1
      const grade = parseInt(cfg.grade) || 1
      for (let sec = 1; sec <= count; sec++) {
        inserts.push({ school_id: schoolId, grade, section: sec, name: `${grade}/${sec}` })
      }
    }
    if (inserts.length === 0) return

    await supabase.from('classrooms')
      .upsert(inserts, { onConflict: 'school_id,grade,section', ignoreDuplicates: true })

    setClassroomConfig(prev => { const n = { ...prev }; delete n[schoolId]; return n })
    loadData()
  }

  // ── Update User Role ──
  const updateUserRole = async (userId: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    loadData()
  }

  // ── Toggle User Active ──
  const toggleUserActive = async (user: Profile) => {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    loadData()
  }

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mesh">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">
              لوحة التحكم
              {isSuperAdmin && (
                <span className="mr-3 text-sm bg-gold-500/10 text-gold-400 border border-gold-500/20 px-3 py-1 rounded-full font-medium">
                  سوبر أدمن
                </span>
              )}
            </h1>
            <p className="text-white/40 text-sm mt-1">أولمبياد الرياضيات - فاقوس</p>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-white/60 hover:text-white transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="text-sm">تحديث</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                tab === id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'glass text-white/50 hover:text-white/80 border border-white/5'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ──── OVERVIEW ──── */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'طلاب مسجلين', value: stats.users, icon: Users, color: 'blue', sub: 'طالب' },
                { label: 'أسئلة منشورة', value: stats.questions, icon: HelpCircle, color: 'purple', sub: 'سؤال' },
                { label: 'إجمالي الإجابات', value: stats.answers, icon: BarChart3, color: 'green', sub: 'إجابة' },
                { label: 'إجابات صحيحة', value: stats.correct, icon: CheckCircle, color: 'gold', sub: `${stats.answers ? Math.round(stats.correct / stats.answers * 100) : 0}%` },
              ].map(({ label, value, icon: Icon, color, sub }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`glass rounded-2xl p-5 border ${
                    color === 'blue' ? 'border-blue-500/20' :
                    color === 'purple' ? 'border-purple-500/20' :
                    color === 'green' ? 'border-green-500/20' :
                    'border-gold-500/20'
                  }`}
                >
                  <Icon size={20} className={`mb-3 ${
                    color === 'blue' ? 'text-blue-400' :
                    color === 'purple' ? 'text-purple-400' :
                    color === 'green' ? 'text-green-400' :
                    'text-gold-400'
                  }`} />
                  <p className={`text-3xl font-black ${
                    color === 'blue' ? 'text-blue-400' :
                    color === 'purple' ? 'text-purple-400' :
                    color === 'green' ? 'text-green-400' :
                    'text-gold-400'
                  }`}>{value.toLocaleString('ar-EG')}</p>
                  <p className="text-white/50 text-sm mt-1">{label}</p>
                  <p className="text-white/25 text-xs">{sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">إجراءات سريعة</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => { setTab('questions'); setShowQForm(true) }}
                  className="btn-primary flex items-center gap-2 text-sm py-2">
                  <Plus size={16} /> سؤال جديد
                </button>
                <button onClick={() => setTab('schools')}
                  className="glass border border-white/10 text-white/70 hover:text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all">
                  <School size={16} /> إدارة المدارس
                </button>
                <button onClick={() => setTab('leaderboard')}
                  className="glass border border-gold-500/20 text-gold-400 hover:border-gold-500/40 px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all">
                  <Trophy size={16} /> لوحة الشرف
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ──── QUESTIONS ──── */}
        {tab === 'questions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Add Question Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{questions.length} سؤال</h2>
              <button onClick={() => setShowQForm(!showQForm)} className="btn-primary flex items-center gap-2 text-sm py-2.5">
                {showQForm ? <X size={16} /> : <Plus size={16} />}
                {showQForm ? 'إلغاء' : 'سؤال جديد'}
              </button>
            </div>

            {/* Question Form */}
            <AnimatePresence>
              {showQForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass rounded-2xl p-6 border border-blue-500/20 overflow-hidden"
                >
                  <h3 className="text-white font-bold mb-5 flex items-center gap-2">
                    <HelpCircle size={18} className="text-blue-400" />
                    إضافة سؤال جديد
                  </h3>

                  <div className="space-y-4">
                    {/* Question text */}
                    <div>
                      <label className="text-white/60 text-sm mb-2 block">نص السؤال *</label>
                      <textarea
                        value={qForm.text}
                        onChange={e => setQForm(f => ({ ...f, text: e.target.value }))}
                        rows={3}
                        placeholder="اكتب السؤال هنا..."
                        className="input-dark resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Time limit */}
                      <div>
                        <label className="text-white/60 text-sm mb-2 block flex items-center gap-1">
                          <Clock size={14} /> وقت الإجابة (ثانية)
                        </label>
                        <input
                          type="number"
                          value={qForm.time_limit}
                          onChange={e => setQForm(f => ({ ...f, time_limit: +e.target.value }))}
                          className="input-dark"
                          min={30}
                          max={3600}
                        />
                        <p className="text-white/25 text-xs mt-1">
                          = {Math.floor(qForm.time_limit / 60)} دقيقة {qForm.time_limit % 60} ثانية
                        </p>
                      </div>

                      {/* Target type */}
                      <div>
                        <label className="text-white/60 text-sm mb-2 block">مخصص لـ</label>
                        <select
                          value={qForm.target_type}
                          onChange={e => setQForm(f => ({ ...f, target_type: e.target.value as typeof f.target_type }))}
                          className="input-dark"
                        >
                          <option value="all">جميع الطلاب</option>
                          <option value="grade">مرحلة معينة</option>
                          <option value="school">مدرسة معينة</option>
                        </select>
                      </div>

                      {/* Target value */}
                      {qForm.target_type === 'grade' && (
                        <div>
                          <label className="text-white/60 text-sm mb-2 block">المرحلة</label>
                          <select
                            value={qForm.target_grade}
                            onChange={e => setQForm(f => ({ ...f, target_grade: e.target.value }))}
                            className="input-dark"
                          >
                            <option value="">اختار...</option>
                            <option value="ابتدائي">ابتدائي</option>
                            <option value="إعدادي">إعدادي</option>
                            <option value="ثانوي">ثانوي</option>
                          </select>
                        </div>
                      )}
                      {qForm.target_type === 'school' && (
                        <div>
                          <label className="text-white/60 text-sm mb-2 block">المدرسة</label>
                          <select
                            value={qForm.target_school_id}
                            onChange={e => setQForm(f => ({ ...f, target_school_id: e.target.value }))}
                            className="input-dark"
                          >
                            <option value="">اختار...</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Choices */}
                    <div>
                      <label className="text-white/60 text-sm mb-3 block">الاختيارات (حدد الصحيح)</label>
                      <div className="space-y-2">
                        {qForm.choices.map((c, i) => {
                          const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
                          return (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              c.is_correct ? 'border-green-500/40 bg-green-500/5' : 'border-white/10 bg-white/3'
                            }`}>
                              <span className="text-white/40 font-bold w-6 text-center">{letters[i]}</span>
                              <input
                                type="text"
                                value={c.text}
                                onChange={e => {
                                  const choices = [...qForm.choices]
                                  choices[i] = { ...choices[i], text: e.target.value }
                                  setQForm(f => ({ ...f, choices }))
                                }}
                                placeholder={`الاختيار ${letters[i]}`}
                                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                              />
                              <button
                                onClick={() => {
                                  const choices = qForm.choices.map((ch, j) => ({ ...ch, is_correct: j === i }))
                                  setQForm(f => ({ ...f, choices }))
                                }}
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                                  c.is_correct
                                    ? 'bg-green-500 border-green-400 text-white'
                                    : 'border-white/20 text-white/20 hover:border-green-500/50 hover:text-green-400'
                                }`}
                              >
                                <CheckCircle size={14} />
                              </button>
                              {qForm.choices.length > 2 && (
                                <button
                                  onClick={() => {
                                    const choices = qForm.choices.filter((_, j) => j !== i)
                                    setQForm(f => ({ ...f, choices }))
                                  }}
                                  className="text-red-400/50 hover:text-red-400"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {qForm.choices.length < 6 && (
                        <button
                          onClick={() => setQForm(f => ({ ...f, choices: [...f.choices, { text: '', is_correct: false }] }))}
                          className="mt-2 text-blue-400/60 hover:text-blue-400 text-sm flex items-center gap-1"
                        >
                          <Plus size={14} /> إضافة اختيار
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <motion.button
                        onClick={saveQuestion}
                        disabled={savingQ}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        {savingQ ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : <Plus size={16} />}
                        حفظ السؤال
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Questions List */}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass rounded-xl overflow-hidden border ${
                    q.is_published ? 'border-green-500/20' : 'border-white/8'
                  }`}
                >
                  {/* Question row */}
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${q.is_published ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                    <p className="text-white/80 text-sm flex-1 line-clamp-2">{q.text}</p>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-white/30 text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {Math.floor(q.time_limit / 60)}:{(q.time_limit % 60).toString().padStart(2, '0')}
                      </span>

                      {/* Target badge */}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/15">
                        {q.target_type === 'all' ? 'الكل' :
                         q.target_type === 'grade' ? q.target_grade :
                         'مدرسة'}
                      </span>

                      {/* Actions */}
                      <button
                        onClick={() => {
                          const next = expandedQ === q.id ? null : q.id
                          setExpandedQ(next)
                          if (next) loadQuestionAnswers(q.id)
                        }}
                        className="text-white/40 hover:text-white/70 p-1 rounded-lg hover:bg-white/5"
                      >
                        {expandedQ === q.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <button
                        onClick={() => togglePublish(q)}
                        className={`p-1.5 rounded-lg transition-all ${
                          q.is_published
                            ? 'text-green-400 hover:bg-green-500/10'
                            : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                        }`}
                        title={q.is_published ? 'إخفاء السؤال' : 'نشر السؤال'}
                      >
                        {q.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>

                      <button
                        onClick={() => deleteQuestion(q.id)}
                        className="text-red-400/40 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: answers list */}
                  <AnimatePresence>
                    {expandedQ === q.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 overflow-hidden"
                      >
                        <div className="p-4">
                          {/* Choices preview */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            {q.choices?.map((c: Choice) => (
                              <div key={c.id} className={`text-xs p-2 rounded-lg border ${
                                c.is_correct ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-white/8 text-white/40'
                              }`}>
                                {c.is_correct && <CheckCircle size={10} className="inline ml-1" />}
                                {c.text}
                              </div>
                            ))}
                          </div>

                          {/* Answers */}
                          <div>
                            <h4 className="text-white/50 text-xs font-bold mb-2">
                              الإجابات ({qAnswers[q.id]?.length || 0}) — مرتبة حسب الأسرع
                            </h4>
                            {!qAnswers[q.id] ? (
                              <p className="text-white/30 text-xs">جاري التحميل...</p>
                            ) : qAnswers[q.id].length === 0 ? (
                              <p className="text-white/25 text-xs">لا توجد إجابات بعد</p>
                            ) : (
                              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {qAnswers[q.id].map((a, ai) => (
                                  <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${
                                    a.is_correct ? 'bg-green-500/5' : 'bg-red-500/5'
                                  }`}>
                                    <span className="text-white/25 w-5 text-center font-bold">{ai + 1}</span>
                                    <span className={a.is_correct ? 'text-green-400' : 'text-red-400'}>
                                      {a.is_correct ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                    </span>
                                    <span className="text-white/70 font-medium flex-1">
                                      {a.profile?.full_name || a.profile?.username}
                                    </span>
                                    <span className="text-white/30">
                                      {a.profile?.school?.name} · {a.profile?.classroom?.name}
                                    </span>
                                    <span className="text-white/20">
                                      {new Date(a.answered_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <span className="text-white/40 max-w-24 truncate">{a.choice?.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {questions.length === 0 && (
                <div className="glass rounded-xl p-10 text-center text-white/30">
                  <HelpCircle size={40} className="mx-auto mb-3 opacity-30" />
                  <p>لا توجد أسئلة بعد</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ──── SCHOOLS ──── */}
        {tab === 'schools' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Add school */}
            <div className="glass rounded-2xl p-5 border border-blue-500/15">
              <h3 className="text-white font-bold mb-4">إضافة مدرسة جديدة</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  placeholder="اسم المدرسة..."
                  className="input-dark flex-1"
                  onKeyDown={e => e.key === 'Enter' && addSchool()}
                />
                <button onClick={addSchool} disabled={savingSchool} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus size={16} /> إضافة
                </button>
              </div>
            </div>

            {/* Schools list */}
            <div className="space-y-4">
              {schools.map(s => {
                const schoolClassrooms = classrooms.filter(c => c.school_id === s.id)
                const config = classroomConfig[s.id]

                return (
                  <div key={s.id} className="glass rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                          <School size={18} className="text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{s.name}</p>
                          <p className="text-white/40 text-xs">{schoolClassrooms.length} فصل مضاف</p>
                        </div>
                      </div>

                      {/* Classroom generator */}
                      {!config ? (
                        <button
                          onClick={() => setClassroomConfig(prev => ({ ...prev, [s.id]: [{ grade: '1', count: '1' }] }))}
                          className="text-blue-400/60 hover:text-blue-400 text-sm flex items-center gap-1"
                        >
                          <Plus size={14} /> فصول
                        </button>
                      ) : (
                        <button onClick={() => setClassroomConfig(prev => { const n = { ...prev }; delete n[s.id]; return n })}
                          className="text-white/30 hover:text-white/60 text-sm">
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Classroom config panel */}
                    {config && (
                      <div className="border-t border-white/5 p-4">
                        <p className="text-white/50 text-sm mb-3">توليد الفصول تلقائياً</p>
                        <div className="space-y-2">
                          {config.map((cfg, ci) => (
                            <div key={ci} className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white/40 text-xs">الصف</span>
                                <input
                                  type="number"
                                  value={cfg.grade}
                                  onChange={e => {
                                    const nc = [...config]; nc[ci] = { ...nc[ci], grade: e.target.value }
                                    setClassroomConfig(prev => ({ ...prev, [s.id]: nc }))
                                  }}
                                  className="w-14 input-dark text-center py-1.5 text-sm"
                                  min={1}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white/40 text-xs">عدد الفصول</span>
                                <input
                                  type="number"
                                  value={cfg.count}
                                  onChange={e => {
                                    const nc = [...config]; nc[ci] = { ...nc[ci], count: e.target.value }
                                    setClassroomConfig(prev => ({ ...prev, [s.id]: nc }))
                                  }}
                                  className="w-16 input-dark text-center py-1.5 text-sm"
                                  min={1}
                                  max={30}
                                />
                              </div>
                              <span className="text-white/25 text-xs">
                                → {cfg.grade}/1 → {cfg.grade}/{cfg.count}
                              </span>
                              <button onClick={() => {
                                const nc = config.filter((_, j) => j !== ci)
                                setClassroomConfig(prev => ({ ...prev, [s.id]: nc }))
                              }} className="text-red-400/40 hover:text-red-400">
                                <X size={14} />
                              </button>
                            </div>
                          ))}

                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setClassroomConfig(prev => ({ ...prev, [s.id]: [...config, { grade: String(config.length + 1), count: '1' }] }))}
                              className="text-blue-400/60 hover:text-blue-400 text-xs flex items-center gap-1"
                            >
                              <Plus size={12} /> صف جديد
                            </button>
                            <button onClick={() => generateClassrooms(s.id)} className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1">
                              <Zap size={12} /> توليد الفصول
                            </button>
                          </div>
                        </div>

                        {/* Preview classrooms */}
                        {schoolClassrooms.length > 0 && (
                          <div className="mt-4">
                            <p className="text-white/30 text-xs mb-2">الفصول المضافة:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {schoolClassrooms.map(c => (
                                <span key={c.id} className="glass px-2.5 py-1 rounded-lg text-xs text-white/50 border border-white/8">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {schools.length === 0 && (
                <div className="glass rounded-xl p-10 text-center text-white/30">
                  <School size={40} className="mx-auto mb-3 opacity-30" />
                  <p>لا توجد مدارس بعد</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ──── USERS ──── */}
        {tab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">{users.length} مستخدم</h2>
            </div>

            <div className="space-y-2">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass rounded-xl p-4 flex items-center gap-3 border ${
                    !u.is_active ? 'border-red-500/15 opacity-60' :
                    u.role !== 'student' ? 'border-gold-500/20' :
                    'border-white/5'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    u.role === 'superadmin' ? 'bg-gold-500/20 text-gold-400' :
                    u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>
                    {u.role === 'superadmin' ? <Crown size={16} /> :
                     u.role === 'admin' ? <Shield size={16} /> :
                     (u.username[0] || 'U').toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm truncate">{u.full_name || u.username}</p>
                      <span className="text-white/30 text-xs">@{u.username}</span>
                    </div>
                    <p className="text-white/35 text-xs">
                      {u.school?.name} · {u.classroom?.name} · {u.grade_level}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      u.role === 'superadmin' ? 'bg-gold-500/10 text-gold-400 border-gold-500/20' :
                      u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      'bg-blue-500/8 text-blue-400/60 border-blue-500/15'
                    }`}>
                      {u.role === 'superadmin' ? 'سوبر أدمن' : u.role === 'admin' ? 'أدمن' : 'طالب'}
                    </span>

                    {isSuperAdmin && u.id !== profile?.id && (
                      <>
                        <select
                          value={u.role}
                          onChange={e => updateUserRole(u.id, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 text-xs"
                        >
                          <option value="student">طالب</option>
                          <option value="admin">أدمن</option>
                          <option value="superadmin">سوبر أدمن</option>
                        </select>

                        <button
                          onClick={() => toggleUserActive(u)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            u.is_active
                              ? 'border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40'
                              : 'border-green-500/20 text-green-400/60 hover:text-green-400 hover:border-green-500/40'
                          }`}
                        >
                          {u.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {users.length === 0 && (
                <div className="glass rounded-xl p-10 text-center text-white/30">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>لا يوجد مستخدمين بعد</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ──── LEADERBOARD ──── */}
        {tab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-white font-bold mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-gold-400" />
              لوحة الشرف الكاملة
            </h2>

            <div className="space-y-2">
              {leaderboard.map((entry, i) => {
                const rank = i + 1
                const rankColors = [
                  'border-yellow-500/30 bg-yellow-500/5',
                  'border-slate-400/25 bg-slate-400/5',
                  'border-amber-600/25 bg-amber-600/5',
                ]

                return (
                  <motion.div
                    key={entry.profile.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5) }}
                    className={`glass rounded-xl p-4 flex items-center gap-4 border ${
                      rankColors[rank - 1] || 'border-white/5'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      rank === 1 ? 'rank-1 text-white' :
                      rank === 2 ? 'rank-2 text-white' :
                      rank === 3 ? 'rank-3 text-white' :
                      'bg-white/8 text-white/40'
                    }`}>
                      {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {entry.profile.full_name || entry.profile.username}
                      </p>
                      <p className="text-white/35 text-xs">
                        {entry.profile.school?.name} · {entry.profile.classroom?.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                      <div className="text-center">
                        <p className="text-green-400 font-black">{entry.correct}</p>
                        <p className="text-white/25 text-xs">صح</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white/50 font-bold">{entry.total}</p>
                        <p className="text-white/25 text-xs">إجمالي</p>
                      </div>
                      <div className="text-center">
                        <p className="text-blue-400 font-bold">
                          {entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0}%
                        </p>
                        <p className="text-white/25 text-xs">دقة</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {leaderboard.length === 0 && (
                <div className="glass rounded-xl p-16 text-center">
                  <Trophy size={50} className="mx-auto mb-4 text-gold-400/20" />
                  <p className="text-white/30">لا توجد بيانات بعد</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
