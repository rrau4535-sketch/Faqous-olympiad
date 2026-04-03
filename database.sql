-- =====================================================
--  Faqous Math Olympiad - Complete Database Schema
--  Run this in Supabase SQL Editor
-- =====================================================

-- ── 1. Enable UUID extension ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. Schools ──
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Classrooms ──
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  grade INTEGER NOT NULL,
  section INTEGER NOT NULL,
  name TEXT GENERATED ALWAYS AS (grade::TEXT || '/' || section::TEXT) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, grade, section)
);

-- ── 4. Profiles (extends auth.users) ──
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin', 'superadmin')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  grade_level TEXT CHECK (grade_level IN ('ابتدائي', 'إعدادي', 'ثانوي')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Questions ──
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 300,  -- seconds
  target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'grade', 'school')),
  target_grade TEXT CHECK (target_grade IN ('ابتدائي', 'إعدادي', 'ثانوي')),
  target_school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Choices ──
CREATE TABLE IF NOT EXISTS choices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_num INTEGER DEFAULT 0
);

-- ── 7. Answers ──
CREATE TABLE IF NOT EXISTS answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  choice_id UUID REFERENCES choices(id) ON DELETE CASCADE NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)   -- طالب يجاوب مرة واحدة بس
);

-- =====================================================
--  Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classrooms_school ON classrooms(school_id);
CREATE INDEX IF NOT EXISTS idx_questions_published ON questions(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_choices_question ON choices(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);

-- =====================================================
--  Row Level Security
-- =====================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- ── Helper: get current user role ──
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Helper: is admin or superadmin ──
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
    AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Schools: anyone read, only admin write ──
CREATE POLICY "schools_read_all" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_admin_write" ON schools FOR ALL USING (is_admin());

-- ── Classrooms: anyone read, only admin write ──
CREATE POLICY "classrooms_read_all" ON classrooms FOR SELECT USING (true);
CREATE POLICY "classrooms_admin_write" ON classrooms FOR ALL USING (is_admin());

-- ── Profiles: users see their own, admins see all ──
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin());

-- ── Questions: published ones for students, all for admins ──
CREATE POLICY "questions_student_read" ON questions FOR SELECT
  USING (is_published = TRUE OR is_admin());

CREATE POLICY "questions_admin_write" ON questions FOR INSERT USING (is_admin());
CREATE POLICY "questions_admin_update" ON questions FOR UPDATE USING (is_admin());
CREATE POLICY "questions_admin_delete" ON questions FOR DELETE USING (is_admin());

-- ── Choices: readable by all (needed for answering), writable by admins ──
CREATE POLICY "choices_read_all" ON choices FOR SELECT USING (true);
CREATE POLICY "choices_admin_write" ON choices FOR ALL USING (is_admin());

-- ── Answers: student sees own, admin sees all ──
CREATE POLICY "answers_student_insert" ON answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "answers_read" ON answers FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- =====================================================
--  Realtime: enable for live updates
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- =====================================================
--  Auto-confirm emails (for username/password flow)
--  Run this in Supabase Dashboard > Authentication > Settings
--  OR use the SQL below to disable email confirmation
-- =====================================================

-- IMPORTANT: Go to Supabase Dashboard:
-- Authentication > Providers > Email
-- Uncheck "Confirm email" to allow instant login without email verification

-- =====================================================
--  Create first superadmin manually
--  After you register normally, run this to promote yourself:
-- =====================================================
-- UPDATE profiles SET role = 'superadmin' WHERE username = 'your_username';
