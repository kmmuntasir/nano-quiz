export interface Quiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  canStart: boolean;
  participated: boolean;
  userScore: number | null;
}

export interface QuizSession {
  seed: string;
  quizId: string;
  questionCount: number;
  timeLimitSeconds: number;
}

export interface Question {
  seq: number;
  total: number;
  text: string;
  options: string[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  durationMs: number;
}

export interface LeaderboardData {
  quizId: string;
  page: number;
  pageSize: number;
  total: number;
  entries: LeaderboardEntry[];
}

export interface AdminQuiz {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  questionBankSize: number;
  attemptCount: number;
}

export interface AdminQuestion {
  id: string;
  text: string;
  options: string[];
  correctOpt: number;
}

export interface QuizInput {
  title: string;
  description: string | null;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
}

export interface QuestionInput {
  text: string;
  options: string[];
  correctOpt: number;
}

export interface SubmitResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationMs: number;
  participated: boolean;
}
