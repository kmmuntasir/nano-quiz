import { useCallback } from 'react';
import type { SyntheticEvent } from 'react';
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
  // Anti-copy measures (select-none + blocked copy/cut/contextmenu): a
  // deterrent against casual copying only, not an absolute protection — the
  // text still reaches the client. Scoped to the quiz card, not the document.
  const blockCopying = useCallback((event: SyntheticEvent) => {
    event.preventDefault();
  }, []);

  return (
    <section
      className="flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 md:gap-5 md:p-6 dark:border-slate-800 dark:bg-slate-900"
      onCopy={blockCopying}
      onCut={blockCopying}
      onContextMenu={blockCopying}
    >
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400 md:text-sm">
        {question.seq} of {question.total}
      </p>
      <h2 className="text-lg font-semibold text-slate-900 select-none md:text-xl dark:text-white">
        {question.text}
      </h2>
      <div className="flex flex-col gap-2 md:gap-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(index)}
            className="w-full rounded-md border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors select-none hover:border-brand-400 hover:ring-1 hover:ring-brand-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:border-slate-200 disabled:hover:ring-0 md:py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:ring-brand-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 dark:disabled:hover:ring-0"
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}
