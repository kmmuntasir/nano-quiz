import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError, fetchQuestion, submitQuiz } from '../api/client';
import type { Question, QuizSession, SubmitResult } from '../api/types';
import QuestionDisplay from '../components/QuestionDisplay';
import TopBar from '../components/TopBar';

const SUBMIT_MAX_RETRIES = 3;
const SUBMIT_RETRY_DELAY_MS = 1000;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const SUBMIT_FAILED_MESSAGE = 'We could not save your result. Please retry.';

type SubmitState = 'idle' | 'submitting' | 'failed';

interface QuizPlayLocationState {
  session?: QuizSession;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function QuizPlay() {
  const location = useLocation();
  const state = location.state as QuizPlayLocationState | null;
  const session = state?.session;

  const [seq, setSeq] = useState(1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    // Capture the attempt start time once on mount; Date.now() is impure during render.
    startedAt.current = Date.now();
  }, []);

  const load = useCallback(async () => {
    if (session === undefined) {
      return;
    }
    try {
      const data = await fetchQuestion(session.quizId, seq, session.seed);
      setQuestion(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR_MESSAGE);
    }
  }, [session, seq]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, retryCount]);

  const doSubmit = useCallback(
    async (finalAnswers: number[]) => {
      if (session === undefined) {
        return;
      }
      setSubmitState('submitting');
      const payload = {
        seed: session.seed,
        answers: finalAnswers,
        elapsedMs: Date.now() - startedAt.current,
      };
      for (let attempt = 0; attempt <= SUBMIT_MAX_RETRIES; attempt += 1) {
        try {
          const submitted = await submitQuiz(session.quizId, payload);
          setResult(submitted);
          setSubmitState('idle');
          return;
        } catch (cause) {
          const isNetworkFailure = cause instanceof ApiError && cause.status === 0;
          if (isNetworkFailure && attempt < SUBMIT_MAX_RETRIES) {
            await sleep(SUBMIT_RETRY_DELAY_MS);
            continue;
          }
          setSubmitState('failed');
          return;
        }
      }
    },
    [session],
  );

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (session === undefined || submitState === 'submitting') {
        return;
      }
      const nextAnswers = [...answers];
      nextAnswers[seq - 1] = optionIndex;
      setAnswers(nextAnswers);

      if (seq < session.questionCount) {
        setSeq(seq + 1);
        setQuestion(null);
        setError(null);
        return;
      }
      void doSubmit(nextAnswers);
    },
    [answers, doSubmit, seq, session, submitState],
  );

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const isLoading = question === null && error === null && result === null;

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="flex w-full max-w-md flex-col gap-4">
          {result !== null && (
            <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Quiz complete
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You scored {result.correctCount} of {result.totalQuestions}
              </p>
            </section>
          )}

          {result === null && submitState === 'submitting' && (
            <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400" aria-busy="true">
                Submitting…
              </p>
            </section>
          )}

          {result === null && submitState === 'failed' && (
            <section className="flex flex-col items-center gap-4 py-8 text-center">
              <p role="alert" className="text-sm text-slate-600 dark:text-slate-300">
                {SUBMIT_FAILED_MESSAGE}
              </p>
              <button
                type="button"
                onClick={() => void doSubmit(answers)}
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Retry
              </button>
            </section>
          )}

          {result === null && submitState === 'idle' && error !== null && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p role="alert" className="text-sm text-slate-600 dark:text-slate-300">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Retry
              </button>
            </div>
          )}

          {result === null && submitState === 'idle' && error === null && isLoading && (
            <div
              className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              aria-busy="true"
              aria-label="Loading question"
            />
          )}

          {result === null && submitState === 'idle' && error === null && question !== null && (
            <QuestionDisplay question={question} onAnswer={handleAnswer} />
          )}
        </div>
      </main>
    </div>
  );
}
