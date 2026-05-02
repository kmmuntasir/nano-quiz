-- OpenQuiz Database Schema
-- Product Requirements Document v1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    score INT CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL CHECK (category IN ('faq', 'trivia')),
    question_text TEXT NOT NULL,
    opt_a VARCHAR(255) NOT NULL,
    opt_b VARCHAR(255) NOT NULL,
    opt_c VARCHAR(255) NOT NULL,
    opt_d VARCHAR(255) NOT NULL,
    correct_opt CHAR(1) NOT NULL CHECK (correct_opt IN ('A', 'B', 'C', 'D')),
    UNIQUE (category, question_text)
);

-- Table: user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    sequence_order INT NOT NULL CHECK (sequence_order BETWEEN 1 AND 10),
    user_answer CHAR(1) CHECK (user_answer IS NULL OR user_answer IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    UNIQUE (user_id, sequence_order),
    UNIQUE (user_id, question_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_seq ON user_sessions(user_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_user_sessions_question_id ON user_sessions(question_id);
CREATE INDEX IF NOT EXISTS idx_users_leaderboard ON users(score DESC NULLS LAST) WHERE completed_at IS NOT NULL;

-- Auto-update updated_at on users row changes
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();