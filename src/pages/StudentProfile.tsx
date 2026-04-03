import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, CheckCircle, XCircle, Clock, Star, Target, User, School, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/shared/Navbar'
import type { Answer } from '../types'

interface AnswerDetail extends Answer {
  question: { id: string; text: string; published_at: string }
  choice: { id: string; text: string; is_correct: boolean }
  correct_choice?: { text: string }
}

interface RankInfo {
  rank: number
  total: number
}

export default function StudentProfile() {
  const { profile } = useAuth()
  const [answers, setAnswers] = useState<AnswerDetail[]>([])
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = async () => {
    // Load my answers with question and choice details
    const { data: answersData } = await supabase
      .from('answers')
      .select(`
        *,
        question:questions(id, text, published_at),
        choice:choices!answers_choice_id_fkey(id, text, is_correct)
      `)
      .eq('user_id', profile!.id)
      .order('answered_at', { ascending: false })

    if (answersData) {
      // For wrong answers, get the correct choice
      const enriched = await Promise.all(answersData.map(async (a: AnswerDetail) => {
        if (!a.is_correct) {
          const { data: correctChoice } = await supabase
            .from('choices')
            .select('text')
            .eq('question_id', a.question?.id)
            .eq('is_correct', true)
            .single()
          return { ...a, correct_choice: correctChoice }
        }
        return a
      }))
      setAnswers(enriched)
    }

    // Calculate rank: count students with more correct answers
    const { data: allScores } = await supabase
      .from('answers')
      .select('user_id, is_correct')

    if (allScores) {
      const scores: Record<string, number> = {}
      allScores.forEach((a: { user_id: string; is_correct: boolean }) => {
        if (a.is_correct) scores[a.user_id] = (scores[a.user_id] || 0) + 1
      })

      const myScore = scores[profile!.id] || 0
      const higherCount = Object.values(scores).filter(s => s > myScore).length
      const totalStudents = Object.keys(scores).length

      setRankInfo({ rank: higherCount + 1, total: totalStudents })
    }

    setLoading(false)
  }

  const correctCount = answers.filter(a => a.is_correct).length
  const totalCount = answers.length
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' }
    if (rank === 2) return { emoji: '🥈', color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/30' }
    if (rank === 3) return { emoji: '🥉', color: 'text-amber-600', bg: 'bg-amber-700/10 border-amber-600/30' }
    if (rank <= 10) return { emoji: '🏅', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' }
    return { emoji: '⭐', color: 'text-white/60', bg: 'bg-white/5 border-white/10' }
  }

  const rankBadge = rankInfo ? getRankBadge(rankInfo.rank) : null

  return (
    <div className="min-h-screen bg-mesh">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-6"
          style={{ boxShadow: '0 0 40px rgba(59,130,246,0.08)' }}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl glass-gold flex items-center justify-center text-3xl font-black text-gold-400"
                style={{ boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}>
                {(profile?.full_name || profile?.username || 'U')[0].toUpperCase()}
              </div>
              {rankInfo && rankInfo.rank <= 3 && (
                <div className="absolute -top-2 -right-2 text-xl">{rankBadge?.emoji}</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-right">
              <h1 className="text-2xl font-black text-white">
                {profile?.full_name || profile?.username}
              </h1>
              <p className="text-white/50 text-sm mt-1">@{profile?.username}</p>

              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="flex items-center gap-1.5 glass px-3 py-1 rounded-lg text-xs text-white/60">
                  <School size={12} />
                  {profile?.school?.name || 'غير محدد'}
                </span>
                <span className="flex items-center gap-1.5 glass px-3 py-1 rounded-lg text-xs text-white/60">
                  <BookOpen size={12} />
                  {profile?.classroom?.name || 'غير محدد'} · {profile?.grade_level}
                </span>
              </div>
            </div>

            {/* Rank */}
            {rankInfo && rankBadge && (
              <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border ${rankBadge.bg}`}>
                <span className="text-3xl">{rankBadge.emoji}</span>
                <span className={`text-2xl font-black ${rankBadge.color}`}>#{rankInfo.rank}</span>
                <span className="text-white/30 text-xs">من {rankInfo.total}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'إجمالي الإجابات', value: totalCount, icon: Target, color: 'blue' },
            { label: 'إجابات صحيحة', value: correctCount, icon: CheckCircle, color: 'green' },
            { label: 'إجابات خاطئة', value: totalCount - correctCount, icon: XCircle, color: 'red' },
            { label: 'نسبة الدقة', value: `${accuracy}%`, icon: Star, color: 'gold' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`glass rounded-xl p-4 text-center border ${
                color === 'blue' ? 'border-blue-500/20' :
                color === 'green' ? 'border-green-500/20' :
                color === 'red' ? 'border-red-500/20' :
                'border-gold-500/20'
              }`}
            >
              <Icon size={20} className={`mx-auto mb-2 ${
                color === 'blue' ? 'text-blue-400' :
                color === 'green' ? 'text-green-400' :
                color === 'red' ? 'text-red-400' :
                'text-gold-400'
              }`} />
              <p className={`text-2xl font-black ${
                color === 'blue' ? 'text-blue-400' :
                color === 'green' ? 'text-green-400' :
                color === 'red' ? 'text-red-400' :
                'text-gold-400'
              }`}>{value}</p>
              <p className="text-white/40 text-xs mt-1">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Answer History */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-400" />
            سجل إجاباتي
          </h2>

          {loading ? (
            <div className="glass rounded-xl p-8 text-center text-white/40">
              جاري التحميل...
            </div>
          ) : answers.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-white/40">لم تجاوب على أي سؤال بعد</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {answers.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass rounded-xl p-4 border ${
                    a.is_correct ? 'border-green-500/15' : 'border-red-500/15'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      a.is_correct ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {a.is_correct
                        ? <CheckCircle size={16} className="text-green-400" />
                        : <XCircle size={16} className="text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm leading-relaxed">{a.question?.text}</p>
                      <div className="mt-2 flex flex-col gap-1">
                        <p className={`text-xs ${a.is_correct ? 'text-green-400/80' : 'text-red-400/80'}`}>
                          إجابتك: {a.choice?.text}
                        </p>
                        {!a.is_correct && a.correct_choice && (
                          <p className="text-green-400/60 text-xs">
                            الصحيحة: {a.correct_choice.text}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-white/25 text-xs flex-shrink-0">
                      {new Date(a.answered_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
