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

export interface SubmitResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationMs: number;
  participated: boolean;
}
