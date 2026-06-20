// Floating chat assistant — visible on every authenticated page. Manager-tier
// roles (owner/admin/accountant/bookkeeper) get org-wide read-only data tools;
// everyone else gets a narrower assistant scoped to their own records only.
// That distinction is enforced server-side in routers/chat.ts — this widget
// just renders whatever the backend returns.
import React, { useEffect, useRef, useState } from 'react';
import { trpc } from '../api';
import { useAuthStore } from '../store';
import { MessageCircle, X, Send } from 'lucide-react';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'skarion_chat_conversation_id';

export default function ChatWidget(): React.ReactElement | null {
  const { isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMutation = trpc.chat.sendMessage.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (!isAuthenticated) return null;

  async function handleSend() {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, role: 'user', content: text }]);

    try {
      const result = await sendMutation.mutateAsync({
        message: text,
        conversationId: conversationId ?? undefined,
      });
      if (!conversationId) {
        setConversationId(result.conversationId);
        localStorage.setItem(STORAGE_KEY, result.conversationId);
      }
      setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: 'assistant', content: result.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: `(error) ${message}` }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-700"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">Skarion Assistant</span>
        <button onClick={() => setOpen(false)} title="Close" className="text-gray-400 hover:text-gray-700">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">
            Ask about invoices, compliance, payroll, or your own PTO and timesheets.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sendMutation.isPending && <p className="text-xs text-gray-400">Thinking...</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-600">{error}</p>}

      <div className="flex items-end gap-2 border-t border-gray-200 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask something..."
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={() => void handleSend()}
          disabled={sendMutation.isPending || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-600 text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
