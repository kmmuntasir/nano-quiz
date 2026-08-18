import type { Question } from '../api/types';

export interface QuestionDisplayProps {
  question: Question;
  onAnswer: (optionIndex: number) => void;
  disabled?: boolean;
}

export default function QuestionDisplay({
  question,
  onAnswer,
  disabled = false,
}: QuestionDisplayProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {question.seq} of {question.total}
      </p>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{question.text}</h2>
      <div className="flex flex-col gap-2">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(index)}
            className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}
