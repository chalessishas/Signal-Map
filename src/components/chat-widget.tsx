// src/components/chat-widget.tsx
"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "What's happening tonight?",
  "Any CLE events today?",
  "Sports events this week?",
  "Free food on campus?",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const reply: Message = {
        role: "assistant",
        text: data.reply ?? data.error ?? "Something went wrong.",
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Ask about events"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-icon">✨</span>
            <div>
              <div className="chat-header-title">Signal</div>
              <div className="chat-header-sub">Campus event assistant</div>
            </div>
          </div>

          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p className="chat-welcome-text">Hey! Ask me about campus events — I know what&apos;s happening right now.</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                <div className="chat-bubble">{msg.text}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg--assistant">
                <div className="chat-bubble chat-bubble--loading">
                  <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-input-bar"
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <input
              className="chat-input"
              type="text"
              placeholder="Ask about events..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <button type="submit" className="chat-send" disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
