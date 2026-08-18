import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  adminFetchQuizzes,
  createQuestion,
  deleteQuestion,
  fetchQuestions,
  updateQuestion,
} from '../api/client';
import type { AdminQuestion, QuestionCategory, QuestionInput } from '../api/types';
import TopBar from '../components/TopBar';

const MIN_OPTIONS = 2;
const SKELETON_COUNT = 3;

const BADGE_BASE_CLASS = 'rounded-full px-2 py-0.5 text-xs font-medium';
const INPUT_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const LABEL_CLASS =
  'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';
const FIELD_ERROR_CLASS = 'mt-1 text-xs text-red-600 dark:text-red-400';

type LoadStatus = 'loading' | 'not-found' | 'error' | 'ready';

interface FormState {
  text: string;
  options: string[];
  correctOpt: number;
  category: QuestionCategory;
}

interface FormErrors {
  text?: string;
  options?: string;
}

const EMPTY_FORM: FormState = {
  text: '',
  options: ['', ''],
  correctOpt: 0,
  category: 'general',
};

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.text.trim() === '') {
    errors.text = 'Question text is required.';
  }
  if (form.options.length < MIN_OPTIONS) {
    errors.options = `At least ${MIN_OPTIONS} options are required.`;
  } else if (form.options.some((option) => option.trim() === '')) {
    errors.options = 'All options must have text.';
  }
  return errors;
}

function toInput(form: FormState): QuestionInput {
  return {
    text: form.text.trim(),
    options: form.options.map((option) => option.trim()),
    correctOpt: form.correctOpt,
    category: form.category,
  };
}

function formStateFromQuestion(question: AdminQuestion): FormState {
  return {
    text: question.text,
    options: [...question.options],
    correctOpt: question.correctOpt,
    category: question.category,
  };
}

interface QuestionFormProps {
  formId: string;
  initial: FormState;
  submitLabel: string;
  submitError: string | null;
  submitting: boolean;
  onSubmit: (input: QuestionInput) => Promise<boolean>;
  onCancel?: () => void;
}

function QuestionForm({
  formId,
  initial,
  submitLabel,
  submitError,
  submitting,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  function addOption(): void {
    setForm((current) => ({ ...current, options: [...current.options, ''] }));
  }

  function removeOption(index: number): void {
    setForm((current) => {
      const options = current.options.filter(
        (_, optionIndex) => optionIndex !== index,
      );
      const correctOpt = Math.min(
        index < current.correctOpt
          ? current.correctOpt - 1
          : current.correctOpt,
        options.length - 1,
      );
      return { ...current, options, correctOpt };
    });
  }

  function updateOption(index: number, value: string): void {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    }));
  }

  function selectCorrect(index: number): void {
    setForm((current) => ({ ...current, correctOpt: index }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const succeeded = await onSubmit(toInput(form));
    if (succeeded) {
      setForm(initial);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex flex-col gap-4"
      aria-labelledby={formId}
    >
      <h3
        id={formId}
        className="text-sm font-semibold text-slate-900 dark:text-slate-100"
      >
        {submitLabel}
      </h3>
      <div>
        <label htmlFor={`${formId}-text`} className={LABEL_CLASS}>
          Question text
        </label>
        <textarea
          id={`${formId}-text`}
          value={form.text}
          onChange={(event) =>
            setForm((current) => ({ ...current, text: event.target.value }))
          }
          rows={2}
          className={INPUT_CLASS}
        />
        {errors.text !== undefined && (
          <p className={FIELD_ERROR_CLASS}>{errors.text}</p>
        )}
      </div>
      <div>
        <label htmlFor={`${formId}-category`} className={LABEL_CLASS}>
          Category
        </label>
        <select
          id={`${formId}-category`}
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              category: event.target.value as QuestionCategory,
            }))
          }
          className={INPUT_CLASS}
        >
          <option value="general">General</option>
          <option value="faq">FAQ</option>
        </select>
      </div>
      <div>
        <span className={LABEL_CLASS}>Options</span>
        <div className="flex flex-col gap-2">
          {form.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${formId}-correct`}
                checked={form.correctOpt === index}
                onChange={() => selectCorrect(index)}
                aria-label={`Correct option ${index + 1}`}
                className="size-4 accent-brand-600"
              />
              <input
                type="text"
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={form.options.length <= MIN_OPTIONS}
                aria-label={`Remove option ${index + 1}`}
                className="shrink-0 text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-red-400 dark:disabled:text-slate-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {errors.options !== undefined && (
          <p className={FIELD_ERROR_CLASS}>{errors.options}</p>
        )}
        <button
          type="button"
          onClick={addOption}
          className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Add option
        </button>
      </div>
      {submitError !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {submitError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

interface QuestionItemProps {
  quizId: string;
  question: AdminQuestion;
  locked: boolean;
  onUpdated: (question: AdminQuestion) => void;
  onDeleted: (questionId: string) => void;
}

function QuestionItem({
  quizId,
  question,
  locked,
  onUpdated,
  onDeleted,
}: QuestionItemProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toMessage(cause: unknown): string {
    return cause instanceof ApiError
      ? cause.message
      : 'Something went wrong. Please try again.';
  }

  async function handleUpdate(input: QuestionInput): Promise<boolean> {
    setSubmitting(true);
    try {
      const updated = await updateQuestion(quizId, question.id, input);
      onUpdated(updated);
      setEditing(false);
      setError(null);
      return true;
    } catch (cause) {
      setError(toMessage(cause));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    try {
      await deleteQuestion(quizId, question.id);
      onDeleted(question.id);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }

  if (editing && !locked) {
    return (
      <li className="rounded-lg border border-brand-200 bg-white p-card dark:border-brand-800 dark:bg-slate-900">
        <QuestionForm
          formId={`edit-question-${question.id}`}
          initial={formStateFromQuestion(question)}
          submitLabel="Save question"
          submitError={error}
          submitting={submitting}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-base">
            {question.text}
          </p>
          <span
            className={`${BADGE_BASE_CLASS} w-fit uppercase ${
              question.category === 'faq'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {question.category}
          </span>
        </div>
        {!locked && (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {question.options.map((option, index) => {
          const isCorrect = index === question.correctOpt;
          return (
            <li
              key={index}
              className={
                isCorrect
                  ? 'flex items-center gap-2 rounded-md border border-green-500 bg-green-50 px-3 py-1.5 text-sm text-slate-900 dark:border-green-700 dark:bg-green-950 dark:text-slate-100'
                  : 'px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300'
              }
            >
              <span>{option}</span>
              {isCorrect && (
                <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-300">
                  Correct
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error !== null && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

export default function AdminQuestions() {
  const { id } = useParams<{ id: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [quizTitle, setQuizTitle] = useState('');
  const [bankSize, setBankSize] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (id === undefined) {
      setLoadStatus('not-found');
      return;
    }
    try {
      const [quizzes, questionList] = await Promise.all([
        adminFetchQuizzes(),
        fetchQuestions(id),
      ]);
      const quiz = quizzes.find((candidate) => candidate.id === id);
      if (quiz === undefined) {
        setLoadStatus('not-found');
        return;
      }
      setQuizTitle(quiz.title);
      setBankSize(questionList.length);
      setQuestionCount(quiz.questionCount);
      setLocked(quiz.attemptCount > 0);
      setQuestions(questionList);
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  }, [id]);

  useEffect(() => {
    // Data fetch on mount/retry; setState happens async after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, retryCount]);

  async function handleCreate(input: QuestionInput): Promise<boolean> {
    if (id === undefined) return false;
    setAdding(true);
    try {
      const created = await createQuestion(id, input);
      setQuestions((current) => [...current, created]);
      setBankSize((current) => current + 1);
      setAddError(null);
      return true;
    } catch (cause) {
      setAddError(
        cause instanceof ApiError
          ? cause.message
          : 'Something went wrong. Please try again.',
      );
      return false;
    } finally {
      setAdding(false);
    }
  }

  function handleUpdated(updated: AdminQuestion): void {
    setQuestions((current) =>
      current.map((question) =>
        question.id === updated.id ? updated : question,
      ),
    );
  }

  function handleDeleted(questionId: string): void {
    setQuestions((current) =>
      current.filter((question) => question.id !== questionId),
    );
    setBankSize((current) => current - 1);
  }

  const playable = bankSize >= questionCount;

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {loadStatus === 'ready' ? quizTitle : 'Questions'}
              </h1>
              {loadStatus === 'ready' && (
                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {bankSize}/{questionCount} questions
                  </span>
                  {playable ? (
                    <span
                      className={`${BADGE_BASE_CLASS} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}
                    >
                      Playable
                    </span>
                  ) : (
                    <span
                      className={`${BADGE_BASE_CLASS} bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300`}
                    >
                      Not yet playable
                    </span>
                  )}
                </p>
              )}
            </div>
            <Link
              to="/admin"
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Back to quizzes
            </Link>
          </div>
          {loadStatus === 'loading' && (
            <div
              aria-busy="true"
              aria-label="Loading questions"
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          )}
          {loadStatus === 'error' && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <p
                role="alert"
                className="text-sm text-slate-600 dark:text-slate-300"
              >
                Something went wrong while loading the questions. Please try
                again.
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
            <>
              {locked && (
                <p
                  role="note"
                  className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  Quiz has attempts — question bank is locked
                </p>
              )}
              {questions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No questions yet
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {questions.map((question) => (
                    <QuestionItem
                      key={question.id}
                      quizId={id ?? ''}
                      question={question}
                      locked={locked}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </ul>
              )}
              {!locked && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900">
                  <QuestionForm
                    formId="add-question"
                    initial={EMPTY_FORM}
                    submitLabel="Add question"
                    submitError={addError}
                    submitting={adding}
                    onSubmit={handleCreate}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
