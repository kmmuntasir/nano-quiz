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
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    score INT
);

-- Table: questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    opt_a VARCHAR(255) NOT NULL,
    opt_b VARCHAR(255) NOT NULL,
    opt_c VARCHAR(255) NOT NULL,
    opt_d VARCHAR(255) NOT NULL,
    correct_opt CHAR(1) NOT NULL
);

-- Table: user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    user_answer CHAR(1)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_score ON users(score DESC);
CREATE INDEX IF NOT EXISTS idx_users_completed_at ON users(completed_at);