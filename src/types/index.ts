// ==============================
// Core Types for Faqous Olympiad
// ==============================

export type UserRole = 'student' | 'admin' | 'superadmin'
export type GradeLevel = 'ابتدائي' | 'إعدادي' | 'ثانوي'
export type TargetType = 'all' | 'grade' | 'school'

export interface School {
  id: string
  name: string
  created_at: string
}

export interface Classroom {
  id: string
  school_id: string
  grade: number
  section: number
  name: string
  created_at: string
  school?: School
}

export interface Profile {
  id: string
  username: string
  full_name?: string
  role: UserRole
  school_id?: string
  classroom_id?: string
  grade_level?: GradeLevel
  is_active: boolean
  created_at: string
  school?: School
  classroom?: Classroom
}

export interface Choice {
  id: string
  question_id: string
  text: string
  is_correct: boolean
  order_num: number
}

export interface Question {
  id: string
  text: string
  time_limit: number // seconds
  target_type: TargetType
  target_grade?: GradeLevel
  target_school_id?: string
  is_published: boolean
  published_at?: string
  created_by?: string
  created_at: string
  choices?: Choice[]
}

export interface Answer {
  id: string
  user_id: string
  question_id: string
  choice_id: string
  is_correct: boolean
  answered_at: string
  profile?: Profile
  choice?: Choice
  question?: Question
}

export interface LeaderboardEntry {
  user_id: string
  username: string
  full_name?: string
  school_name?: string
  classroom_name?: string
  correct_count: number
  total_answered: number
  first_answer_time?: string
  rank: number
}

export interface AdminStats {
  total_users: number
  total_questions: number
  total_answers: number
  active_questions: number
  correct_rate: number
}
