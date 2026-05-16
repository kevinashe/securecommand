import React, { useEffect, useState } from 'react';
import { subscribe, dismissToast, getToasts } from '../lib/toast';
import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState(getToasts);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  const styles: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />,
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const s = styles[toast.type] || styles.error;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${s.bg} ${s.border} animate-slide-in`}
          >
            {s.icon}
            <p className={`text-sm font-medium flex-1 ${s.text}`}>{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
