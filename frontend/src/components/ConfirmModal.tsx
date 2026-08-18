import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmModalProps {
  title?: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      data-testid="confirm-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? confirmLabel}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {title !== undefined && (
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        )}
        <div className="text-sm text-slate-700 dark:text-slate-300">{message}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
