-- ============================================
-- SimuExam - Esquema completo v2
-- Compatible con Neon (PostgreSQL)
-- ============================================

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categorías (compartidas: Red Hat, Kubernetes, Nutanix, etc.)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Definiciones de examen (NCP-US, RHCSA, CKAD, etc.)
CREATE TABLE IF NOT EXISTS exam_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  passing_score NUMERIC(5,2) DEFAULT 70.00,
  suggested_minutes INT DEFAULT 0,
  official_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Temas exclusivos de cada examen
CREATE TABLE IF NOT EXISTS exam_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_definition_id UUID NOT NULL REFERENCES exam_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Preguntas exclusivas de cada tema
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_topic_id UUID NOT NULL REFERENCES exam_topics(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  image_url TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Opciones de respuesta para cada pregunta
CREATE TABLE IF NOT EXISTS exam_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sesiones de examen (intentos de usuario)
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  exam_definition_id UUID NOT NULL REFERENCES exam_definitions(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'exam')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  total_questions INT NOT NULL DEFAULT 0,
  correct_answers INT DEFAULT 0,
  score NUMERIC(5,2),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Respuestas del usuario por ciclo
CREATE TABLE IF NOT EXISTS session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option_ids JSONB NOT NULL DEFAULT '[]',
  is_correct BOOLEAN NOT NULL,
  cycle_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_exam_definitions_category ON exam_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_exam_topics_definition ON exam_topics(exam_definition_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_topic ON exam_questions(exam_topic_id);
CREATE INDEX IF NOT EXISTS idx_exam_options_question ON exam_question_options(exam_question_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_definition ON exam_sessions(exam_definition_id);
CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);

-- Limpiar tablas legacy (schema v1)
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
