import React from 'react';
import { useDocuments } from '../../context/DocumentContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useDocuments();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
        let borderClass = 'border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900';

        if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />;
          borderClass = 'border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-900';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
          borderClass = 'border-amber-200 dark:border-amber-800/60 bg-white dark:bg-slate-900';
        } else if (toast.type === 'info') {
          icon = <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />;
          borderClass = 'border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg shadow-slate-950/5 transition-all ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-md transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
