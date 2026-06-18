import React, { useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}-${Math.random()}`, duration: 5000, ...toast },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function addToast(type: ToastType, message: string, duration?: number) {
  useToastStore.getState().addToast({ type, message, duration });
}

const typeConfig: Record<
  ToastType,
  { icon: React.ReactNode; bg: string; border: string; text: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle size={18} />,
    bg: 'bg-white',
    border: 'border-emerald-200',
    text: 'text-gray-800',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: <AlertCircle size={18} />,
    bg: 'bg-white',
    border: 'border-red-200',
    text: 'text-gray-800',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    bg: 'bg-white',
    border: 'border-amber-200',
    text: 'text-gray-800',
    iconColor: 'text-amber-500',
  },
  info: {
    icon: <Info size={18} />,
    bg: 'bg-white',
    border: 'border-blue-200',
    text: 'text-gray-800',
    iconColor: 'text-blue-500',
  },
};

function ToastItem({ toast }: { toast: Toast }): React.ReactElement {
  const { removeToast } = useToastStore();
  const config = typeConfig[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, removeToast]);

  return (
    <div
      className={clsx(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
        'animate-in slide-in-from-right duration-300',
        config.bg,
        config.border
      )}
      role="alert"
    >
      <span className={clsx('mt-0.5 flex-shrink-0', config.iconColor)}>{config.icon}</span>
      <div className="flex-1">
        <p className={clsx('text-sm font-medium', config.text)}>{toast.message}</p>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        aria-label="Dismiss toast"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer(): React.ReactElement {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
