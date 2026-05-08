import { useEffect, useRef, useState } from 'react';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import type { ChatMessage } from '../api';

const POLL_INTERVAL = 5000;

const USER_COLORS = [
  'text-blue-600',
  'text-green-600',
  'text-purple-600',
  'text-pink-600',
  'text-yellow-600',
  'text-indigo-600',
  'text-red-600',
  'text-teal-600',
];

function getUserColor(userId: number): string {
  return USER_COLORS[userId % USER_COLORS.length];
}

export default function ChatPage() {
  const { selectedClubId } = useClub();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content,  setContent]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchMessages() {
    if (!selectedClubId) return;
    try {
      const data = await api.getChatMessages();
      setMessages(data);
    } catch {
      // silently ignore poll errors
    }
  }

  useEffect(() => {
    if (!selectedClubId) { setMessages([]); return; }

    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedClubId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !selectedClubId) return;
    setSending(true);
    setError('');
    try {
      const msg = await api.sendChatMessage(content.trim());
      setMessages((prev) => [...prev, msg]);
      setContent('');
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function isSameDay(a: string, b: string) {
    return a.slice(0, 10) === b.slice(0, 10);
  }

  return (
    <div className="bg-background flex flex-col h-full">
      <header className="bg-card border-b border-border px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">Chat del club</h1>
        <p className="text-xs text-muted-foreground">Mensajes internos del equipo</p>
      </header>

      {!selectedClubId ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <p className="text-lg font-semibold text-foreground">Seleccioná un club para ver el chat</p>
        </div>
      ) : (
        <>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No hay mensajes todavía. ¡Escribí el primero!</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isMe = msg.sender.id === user?.id;
              const showDate = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-3">
                      <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && (
                        <span className={`text-[11px] ml-1 mb-0.5 font-medium ${getUserColor(msg.sender.id)}`}>
                          {msg.sender.name ?? msg.sender.email}
                        </span>
                      )}
                      <div className={[
                        'px-3 py-2 rounded-2xl text-sm break-words',
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-card border border-border text-foreground rounded-bl-sm',
                      ].join(' ')}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-card px-4 py-3">
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
            )}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribí un mensaje…"
                disabled={sending}
                className="flex-1 border border-input rounded-xl px-4 py-2 text-sm
                           bg-background text-foreground
                           focus:outline-none focus:ring-2 focus:ring-indigo-400
                           disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !content.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium
                           hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {sending ? '…' : 'Enviar'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
