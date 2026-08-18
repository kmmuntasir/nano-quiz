import { db } from './index.js';

export interface QuizListRow {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  /** Score from the caller's participation row; NULL when never taken. */
  userScore: number | null;
}

// Single statement — no N+1. Locked ordering via derived rank:
// Live (0) → Upcoming (1) → Ended (2); within Live soonest end first,
// within Upcoming soonest start first, within Ended most recently ended first.
// `now` is bound once (server clock, ISO-UTC) and is lexically comparable
// with the ISO-8601 `Z` timestamps stored in the schema.
interface QuizListParams {
  userId: string;
  now: string;
}

const selectQuizzesForUserStmt = db.prepare<QuizListParams, QuizListRow>(
  `SELECT
     q.id,
     q.title,
     q.description,
     q.question_count AS questionCount,
     q.time_limit_seconds AS timeLimitSeconds,
     q.start_at AS startAt,
     q.end_at AS endAt,
     q.created_at AS createdAt,
     q.updated_at AS updatedAt,
     p.score AS userScore
   FROM quizzes q
   LEFT JOIN participations p
     ON p.quiz_id = q.id AND p.user_id = @userId
   ORDER BY
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN 0
       WHEN q.start_at > @now THEN 1
       ELSE 2
     END,
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN q.end_at
       ELSE NULL
     END ASC,
     CASE
       WHEN q.start_at > @now THEN q.start_at
       ELSE NULL
     END ASC,
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN NULL
       WHEN q.start_at > @now THEN NULL
       ELSE q.end_at
     END DESC`,
);

export const quizzes = {
  listForUser(userId: string, now: string): QuizListRow[] {
    return selectQuizzesForUserStmt.all({ userId, now });
  },
};
