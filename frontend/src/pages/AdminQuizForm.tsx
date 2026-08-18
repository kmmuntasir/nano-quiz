import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, adminFetchQuizzes, createQuiz, updateQuiz } from '../api/client';
import type { AdminQuiz, QuizInput } from '../api/types';
import TopBar from '../components/TopBar';

const DEFAULT_TIME_LIMIT_SECONDS = 15;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

const INPUT_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';
const FIELD_ERROR_CLASS = 'mt-1 text-xs text-red-600 dark:text-red-400';

type LoadStatus = 'loading' | 'not-found' | 'error' | 'ready';

interface FormErrors {
  title?: string;
  questionCount?: string;
  timeLimitSeconds?: string;
  window?: string;
}

interface FormState {
  title: string;
  description: string;
  questionCount: string;
  timeLimitSeconds: string;
  startAt: string;
  endAt: string;
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoInputValue(localValue: string): string {
  return new Date(localValue).toISOString();
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.title.trim() === '') {
    errors.title = 'Title is required.';
  }
  const questionCount = Number(form.questionCount);
  if (!Number.isInteger(questionCount) || questionCount < 1) {
    errors.questionCount = 'Question count must be a positive integer.';
  }
  const timeLimitSeconds = Number(form.timeLimitSeconds);
  if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 1) {
    errors.timeLimitSeconds = 'Time limit must be a positive integer.';
  }
  if (form.startAt === '' || form.endAt === '') {
    errors.window = 'Start and end times are required.';
  } else if (toIsoInputValue(form.endAt) <= toIsoInputValue(form.startAt)) {
    errors.window = 'End time must be after start time.';
  }
  return errors;
}

function toQuizInput(form: FormState): QuizInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() === '' ? null : form.description.trim(),
    questionCount: Number(form.questionCount),
    timeLimitSeconds: Number(form.timeLimitSeconds),
    startAt: toIsoInputValue(form.startAt),
    endAt: toIsoInputValue(form.endAt),
  };
}

function formStateFromQuiz(quiz: AdminQuiz): FormState {
  return {
    title: quiz.title,
    description: quiz.description ?? '',
    questionCount: String(quiz.questionCount),
    timeLimitSeconds: String(quiz.timeLimitSeconds),
    startAt: toLocalInputValue(quiz.startAt),
    endAt: toLocalInputValue(quiz.endAt),
  };
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  questionCount: '',
  timeLimitSeconds: String(DEFAULT_TIME_LIMIT_SECONDS),
  startAt: toLocalInputValue(new Date().toISOString()),
  endAt: toLocalInputValue(new Date(Date.now() + DEFAULT_WINDOW_MS).toISOString()),
};

export default function AdminQuizForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(isEdit ? 'loading' : 'ready');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const quizzes = await adminFetchQuizzes();
        const quiz = quizzes.find((candidate) => candidate.id === id);
        if (cancelled) return;
        if (quiz === undefined) {
          setLoadStatus('not-found');
          return;
        }
        setForm(formStateFromQuiz(quiz));
        setLoadStatus('ready');
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input = toQuizInput(form);
      if (isEdit) {
        await updateQuiz(id, input);
      } else {
        await createQuiz(input);
      }
      navigate('/admin');
    } catch (cause) {
      setSubmitting(false);
      setSubmitError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.',
      );
    }
  }

  const heading = isEdit ? 'Edit quiz' : 'New quiz';

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{heading}</h1>
            <Link
              to="/admin"
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Cancel
            </Link>
          </div>
          {loadStatus === 'loading' && (
            <div
              aria-busy="true"
              aria-label="Loading quiz"
              className="rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          )}
          {loadStatus === 'error' && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <p role="alert" className="text-sm text-slate-600 dark:text-slate-300">
                Something went wrong while loading the quiz. Please try again.
              </p>
              <Link
                to="/admin"
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Back to quizzes
              </Link>
            </div>
          )}
          {loadStatus === 'not-found' && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Quiz not found. It may have been deleted.
              </p>
              <Link
                to="/admin"
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Back to quizzes
              </Link>
            </div>
          )}
          {loadStatus === 'ready' && (
            <form
              onSubmit={(event) => void handleSubmit(event)}
              noValidate
              className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <label htmlFor="quiz-title" className={LABEL_CLASS}>
                  Title
                </label>
                <input
                  id="quiz-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className={INPUT_CLASS}
                />
                {errors.title !== undefined && (
                  <p className={FIELD_ERROR_CLASS}>{errors.title}</p>
                )}
              </div>
              <div>
                <label htmlFor="quiz-description" className={LABEL_CLASS}>
                  Description (optional)
                </label>
                <textarea
                  id="quiz-description"
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={3}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quiz-question-count" className={LABEL_CLASS}>
                    Question count
                  </label>
                  <input
                    id="quiz-question-count"
                    type="number"
                    min={1}
                    value={form.questionCount}
                    onChange={(event) => updateField('questionCount', event.target.value)}
                    className={INPUT_CLASS}
                  />
                  {errors.questionCount !== undefined && (
                    <p className={FIELD_ERROR_CLASS}>{errors.questionCount}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="quiz-time-limit" className={LABEL_CLASS}>
                    Time limit (seconds)
                  </label>
                  <input
                    id="quiz-time-limit"
                    type="number"
                    min={1}
                    value={form.timeLimitSeconds}
                    onChange={(event) => updateField('timeLimitSeconds', event.target.value)}
                    className={INPUT_CLASS}
                  />
                  {errors.timeLimitSeconds !== undefined && (
                    <p className={FIELD_ERROR_CLASS}>{errors.timeLimitSeconds}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quiz-start-at" className={LABEL_CLASS}>
                    Starts at
                  </label>
                  <input
                    id="quiz-start-at"
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => updateField('startAt', event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="quiz-end-at" className={LABEL_CLASS}>
                    Ends at
                  </label>
                  <input
                    id="quiz-end-at"
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) => updateField('endAt', event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              {errors.window !== undefined && <p className={FIELD_ERROR_CLASS}>{errors.window}</p>}
              {submitError !== null && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-fit rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save quiz'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
