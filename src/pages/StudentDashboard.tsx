import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CheckCircle, XCircle, Trophy, Zap, BookOpen, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/shared/Navbar'
import type { Question, Choice, Answer } from '../types'

interface QuestionWithStatus extends Question {
  userAnswer?: Answer
  timeLeft?: number
  isExpired?: boolean
}

export default function StudentDashboard() {
  const { profile } = useAuth()
  const [questions, setQuestions] = useState<QuestionWithStatus[]>([])
  const [myAnswers, setMyAnswers] = useState<Record<string, Answer>>({})
  const [loadingQ, setLoadingQ] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [timers, setTimers] = useState<Record<string, number>>({})

  // Calculate if question is accessible to this student
  const isQuestionForMe = useCallback((q: Question): boolean => {
    if (q.target_type === 'all') return true
    if (q.target_type === 'grade') return q.target_grade === profile?.grade_level
    if (q.target_type === 'school') return q.target_school_id === profile?.school_id
    return false
  }, [profile])

  // Load published questions
  const loadQuestions = useCallback(async () => {
    const { data: qs } = await supabase
      .from('questions')
      .select(`*, choices(*)`)
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (!qs) return

    // Filter questions for this student
    const myQuestions = qs.filter(isQuestionForMe)

    // Load my answers
    const { data: answers } = await supabase
      .from('answers')
      .select('*, choice:choices(*)')
      .eq('user_id', profile!.id)
      .in('question_id', myQuestions.map(q => q.id))

    const answersMap: Record<string, Answer> = {}
    answers?.forEach(a => { answersMap[a.question_id] = a })
    setMyAnswers(answersMap)

    // Calculate time left for each question
    const now = Date.now()
    const questionsWithTime = myQuestions.map(q => {
      const publishedAt = new Date(q.published_at!).getTime()
      const expiresAt = publishedAt + q.time_limit * 1000
      const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000))
      return {
        ...q,
        userAnswer: answersMap[q.id],
        timeLeft,
        isExpired: timeLeft === 0,
      }
    })

    setQuestions(questionsWithTime)
    setLoadingQ(false)

    // Initialize timer state
    const timerInit: Record<string, number> = {}
    questionsWithTime.forEach(q => {
      if (!answersMap[q.id]) timerInit[q.id] = q.timeLeft ?? 0
    })
    setTimers(timerInit)
  }, [profile, isQuestionForMe])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  // Global countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated: Record<string, number> = {}
        let changed = false
        Object.entries(prev).forEach(([id, t]) => {
          const next = Math.max(0, t - 1)
          updated[id] = next
          if (next !== t) changed = true
        })
        if (!changed) return prev
        // Mark expired questions
        setQuestions(qs => qs.map(q => ({
          ...q,
          timeLeft: updated[q.id] ?? q.timeLeft,
          isExpired: (updated[q.id] ?? q.timeLeft ?? 0) === 0,
        })))
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Real-time: new questions published
  useEffect(() => {
    const channel = supabase
      .channel('questions-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'questions',
        filter: 'is_published=eq.true',
      }, () => { loadQuestions() })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'questions',
      }, () => { loadQuestions() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadQuestions])

  const submitAnswer = async (questionId: string, choiceId: string) => {
    if (submitting) return
    setSubmitting(questionId)

    const choice = questions
      .find(q => q.id === questionId)
      ?.choices?.find((c: Choice) => c.id === choiceId)

    const { error } = await supabase.from('answers').insert({
      user_id: profile!.id,
      question_id: questionId,
      choice_id: choiceId,
      is_correct: choice?.is_correct ?? false,
      answered_at: new Date().toISOString(),
    })

    if (!error) {
      const newAnswer: Answer = {
        id: crypto.randomUUID(),
        user_id: profile!.id,
        question_id: questionId,
        choice_id: choiceId,
        is_correct: choice?.is_correct ?? false,
        answered_at: new Date().toISOString(),
      }
      setMyAnswers(prev => ({ ...prev, [questionId]: newAnswer }))
      setQuestions(qs => qs.map(q =>
        q.id === questionId ? { ...q, userAnswer: newAnswer } : q
      ))
    }
    setSubmitting(null)
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getTimerColor = (t: number) => {
    if (t > 60) return 'text-green-400'
    if (t > 20) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getTimerBg = (t: number) => {
    if (t > 60) return 'border-green-500/30 bg-green-500/5'
    if (t > 20) return 'border-yellow-500/30 bg-yellow-500/5'
    return 'border-red-500/30 bg-red-500/5'
  }

  const correctCount = Object.values(myAnswers).filter(a => a.is_correct).length
  const totalAnswered = Object.values(myAnswers).length

  return (
    <div className="min-h-screen bg-mesh">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">
              أهلاً، <span className="text-gold-400">{profile?.full_name || profile?.username}</span> 👋
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {profile?.school?.name} · {profile?.classroom?.name} · {profile?.grade_level}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center glass-blue rounded-xl px-4 py-2">
              <p className="text-2xl font-black text-blue-400">{totalAnswered}</p>
              <p className="text-white/50 text-xs">أجبت</p>
            </div>
            <div className="text-center glass-gold rounded-xl px-4 py-2">
              <p className="text-2xl font-black text-gold-400">{correctCount}</p>
              <p className="text-white/50 text-xs">صح</p>
            </div>
          </div>
        </motion.div>

        {/* Questions list */}
        {loadingQ ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
            />
            <p className="text-white/40">جاري تحميل الأسئلة...</p>
          </div>
        ) : questions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-16 text-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              ⏳
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">لا توجد أسئلة حالياً</h3>
            <p className="text-white/40">انتظر، الأدمن هيضيف أسئلة قريباً!</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <BookOpen size={16} />
              <span>{questions.length} سؤال متاح</span>
            </div>

            <AnimatePresence>
              {questions.map((q, idx) => {
                const answered = myAnswers[q.id]
                const timeLeft = timers[q.id] ?? q.timeLeft ?? 0
                const expired = !answered && timeLeft === 0
                const canAnswer = !answered && !expired

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`glass rounded-2xl overflow-hidden transition-all ${
                      canAnswer
                        ? 'border border-blue-500/20 hover:border-blue-500/40'
                        : answered
                        ? answered.is_correct
                          ? 'border border-green-500/20'
                          : 'border border-red-500/20'
                        : 'border border-white/5 opacity-60'
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4 p-5 pb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          canAnswer ? 'bg-blue-500/20 text-blue-400' :
                          answered?.is_correct ? 'bg-green-500/20 text-green-400' :
                          answered && !answered.is_correct ? 'bg-red-500/20 text-red-400' :
                          'bg-white/5 text-white/30'
                        }`}>
                          {idx + 1}
                        </div>
                        <p className="text-white font-semibold text-base leading-relaxed">{q.text}</p>
                      </div>

                      {/* Status / Timer */}
                      <div className="flex-shrink-0">
                        {answered ? (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${
                            answered.is_correct
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {answered.is_correct ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {answered.is_correct ? 'صح' : 'غلط'}
                          </div>
                        ) : expired ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-white/5 text-white/30 border border-white/10">
                            <Lock size={14} />
                            انتهى الوقت
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold border ${getTimerBg(timeLeft)} ${getTimerColor(timeLeft)}`}>
                            <Clock size={14} />
                            {formatTime(timeLeft)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Choices */}
                    <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {q.choices?.sort((a: Choice, b: Choice) => a.order_num - b.order_num).map((choice: Choice, ci: number) => {
                        const letters = ['أ', 'ب', 'ج', 'د', 'هـ']
                        const isSelected = selected[q.id] === choice.id
                        const isMyAnswer = answered?.choice_id === choice.id
                        const showCorrect = (answered || expired) && choice.is_correct

                        let choiceStyle = 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                        if (!canAnswer) {
                          if (showCorrect) choiceStyle = 'bg-green-500/15 border-green-500/40 text-green-300'
                          else if (isMyAnswer && !choice.is_correct) choiceStyle = 'bg-red-500/15 border-red-500/40 text-red-300'
                          else choiceStyle = 'bg-white/3 border-white/5 text-white/30 cursor-default'
                        } else if (isSelected) {
                          choiceStyle = 'bg-blue-500/20 border-blue-500/50 text-blue-300 cursor-pointer'
                        }

                        return (
                          <motion.button
                            key={choice.id}
                            onClick={() => {
                              if (!canAnswer) return
                              setSelected(prev => ({ ...prev, [q.id]: choice.id }))
                            }}
                            whileHover={canAnswer ? { scale: 1.01 } : {}}
                            whileTap={canAnswer ? { scale: 0.99 } : {}}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${choiceStyle}`}
                            disabled={!canAnswer}
                          >
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                              showCorrect ? 'bg-green-500/30' :
                              isMyAnswer && !choice.is_correct ? 'bg-red-500/30' :
                              isSelected ? 'bg-blue-500/30' : 'bg-white/10'
                            }`}>
                              {letters[ci] || ci + 1}
                            </span>
                            <span className="text-sm leading-relaxed">{choice.text}</span>
                            {showCorrect && <CheckCircle size={14} className="text-green-400 mr-auto flex-shrink-0" />}
                            {isMyAnswer && !choice.is_correct && <XCircle size={14} className="text-red-400 mr-auto flex-shrink-0" />}
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* Submit button */}
                    {canAnswer && selected[q.id] && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-5 pb-5"
                      >
                        <motion.button
                          onClick={() => submitAnswer(q.id, selected[q.id])}
                          disabled={submitting === q.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          {submitting === q.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                            />
                          ) : (
                            <>
                              <Zap size={16} />
                              <span>تأكيد الإجابة</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* After answer: show result message */}
                    {answered && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`mx-5 mb-5 rounded-xl p-3 text-center text-sm font-medium ${
                          answered.is_correct
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {answered.is_correct
                          ? '🎉 إجابة صحيحة! أحسنت'
                          : '❌ إجابة خاطئة. حاول في السؤال القادم!'}
                      </motion.div>
                    )}

                    {/* Expired - no answer */}
                    {expired && !answered && (
                      <div className="mx-5 mb-5 rounded-xl p-3 text-center text-sm text-white/30 bg-white/3 border border-white/5">
                        🔒 انتهى وقت الإجابة على هذا السؤال
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Bottom stats */}
        {!loadingQ && questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 glass rounded-2xl p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Trophy size={16} className="text-gold-400" />
              <span>نتيجتك الحالية</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-black text-xl">{correctCount}</span>
              <span className="text-white/30">/</span>
              <span className="text-white/60 font-bold">{questions.length}</span>
              {totalAnswered > 0 && (
                <span className="text-white/30 text-sm">
                  ({Math.round((correctCount / totalAnswered) * 100)}% صح)
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
