import { useToastStore } from '../stores/toast.js';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`${colors[t.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] animate-in slide-in-from-right`}
          >
            <Icon size={18} />
            <span className="flex-1 text-sm">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="hover:opacity-80">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
