import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, fetchQuestion, submitQuiz } from '../api/client';
import type { Question, QuizSession } from '../api/types';
import QuestionDisplay from '../components/QuestionDisplay';
import TimerCountdown from '../components/TimerCountdown';
import TopBar from '../components/TopBar';
import { useQuizTimer } from '../hooks/useQuizTimer';

const SUBMIT_MAX_RETRIES = 3;
const SUBMIT_RETRY_DELAY_MS = 1000;
const TIMEOUT_SENTINEL = -1;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const SUBMIT_FAILED_MESSAGE = 'We could not save your result. Please retry.';

interface LoadedQuestion {
  question: Question;
  // Maps display position -> original option index; shuffled once at load time
  // (never during render) so answers keep the backend's original indices.
  optionOrder: number[];
}

// Fisher-Yates over [0..length-1]; display-only, so Math.random() is fine here.
function shuffledOptionOrder(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

type SubmitState = 'idle' | 'submitting' | 'failed';

interface QuizPlayLocationState {
  session?: QuizSession;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function QuizPlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as QuizPlayLocationState | null;
  const session = state?.session;

  const [seq, setSeq] = useState(1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [question, setQuestion] = useState<LoadedQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [navigated, setNavigated] = useState(false);
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
      setQuestion({ question: data, optionOrder: shuffledOptionOrder(data.options.length) });
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
      // JSON.stringify drops sparse holes, which would fail the server-side
      // length check — normalize unanswered positions to the timeout sentinel.
      const answersPayload = Array.from(
        { length: session.questionCount },
        (_, i) => finalAnswers[i] ?? TIMEOUT_SENTINEL,
      );
      const payload = {
        seed: session.seed,
        answers: answersPayload,
        elapsedMs: Date.now() - startedAt.current,
      };
      for (let attempt = 0; attempt <= SUBMIT_MAX_RETRIES; attempt += 1) {
        try {
          const submitted = await submitQuiz(session.quizId, payload);
          setNavigated(true);
          setSubmitState('idle');
          navigate(`/quizzes/${session.quizId}/completion`, { state: { result: submitted } });
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
    [navigate, session],
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

  const handleTimeout = useCallback(() => {
    if (session === undefined || submitState !== 'idle' || navigated) {
      return;
    }
    const nextAnswers = [...answers];
    nextAnswers[seq - 1] = TIMEOUT_SENTINEL;
    setAnswers(nextAnswers);

    if (seq < session.questionCount) {
      setSeq(seq + 1);
      setQuestion(null);
      setError(null);
      return;
    }
    void doSubmit(nextAnswers);
  }, [answers, doSubmit, navigated, seq, session, submitState]);

  const { remaining } = useQuizTimer({
    seconds: session?.timeLimitSeconds ?? 0,
    active: submitState === 'idle' && !navigated,
    resetKey: seq,
    onTimeout: handleTimeout,
  });

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const isLoading = question === null && error === null && submitState === 'idle';

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center justify-center p-page">
        <div className="flex w-full max-w-md flex-col gap-4 md:max-w-lg lg:max-w-xl">
          {submitState === 'submitting' && (
            <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                aria-busy="true"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500"
                />
                Submitting…
              </p>
            </section>
          )}

          {submitState === 'failed' && (
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

          {submitState === 'idle' && error !== null && (
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

          {submitState === 'idle' && error === null && isLoading && (
            <div
              className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white md:h-56 dark:border-slate-800 dark:bg-slate-900"
              aria-busy="true"
              aria-label="Loading question"
            />
          )}

          {submitState === 'idle' && error === null && question !== null && (
            <>
              <div className="flex w-full items-center justify-end">
                <TimerCountdown remaining={remaining} />
              </div>
              <QuestionDisplay
                question={{
                  ...question.question,
                  options: question.optionOrder.map((i) => question.question.options[i]),
                }}
                onAnswer={(displayIndex) =>
                  handleAnswer(question.optionOrder[displayIndex] as number)
                }
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
