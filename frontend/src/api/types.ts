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
