"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { SendIcon } from "../ui/icons";
import { ChatMarkdown } from "./ChatMarkdown";
import type { ChatMessage, ChatMessagesPage } from "@/lib/assistant-types";

const MAX_TEXTAREA_HEIGHT_PX = 128; // matches the old max-h-32 cap

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChatBoard({
  initialMessages,
  initialHasMore,
}: {
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Set right before prepending older messages; consumed by the layout
  // effect below to hold the viewport in place instead of jumping to the
  // top of the now-longer list.
  const prevScrollHeightRef = useRef<number | null>(null);
  const didInitialScrollRef = useRef(false);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  // Land at the bottom of history on first paint — a chat always opens on
  // the latest messages, with older ones a scroll-up away.
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    scrollToBottom("auto");
  }, []);

  // Restores scroll position after an older page is prepended, so the
  // messages the user was already looking at don't jump on screen.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || prevScrollHeightRef.current === null) return;
    el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = null;
  }, [messages]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }

  async function loadMore() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = containerRef.current;
    try {
      const oldest = messages[0].created_at;
      const res = await fetch(`/api/assistant/messages?before=${encodeURIComponent(oldest)}`);
      if (!res.ok) return;
      const page: ChatMessagesPage = await res.json();
      if (page.messages.length > 0) {
        prevScrollHeightRef.current = el?.scrollHeight ?? null;
        setMessages((m) => [...page.messages, ...m]);
      }
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 80) void loadMore();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const optimisticUser: ChatMessage = {
      id: newLocalId(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setSending(true);
    requestAnimationFrame(() => scrollToBottom());

    try {
      const res = await fetch("/api/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong — try again.");
        return;
      }
      const assistantMessage: ChatMessage = await res.json();
      setMessages((m) => [...m, assistantMessage]);
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollToBottom());
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {loadingMore && <p className="mb-2 text-center text-xs text-slate-500">Loading earlier messages…</p>}
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Ask about your notes, progress, portfolio, or expenses — e.g. "What interviews do I have coming up?"
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
                    m.role === "user" ? "bg-accent text-surface" : "bg-white/[0.06] text-slate-100"
                  }`}
                >
                  {m.role === "assistant" ? <ChatMarkdown content={m.content} /> : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm text-slate-400">Thinking…</div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-400 sm:px-5">{error}</p>}

      <div className="flex items-end gap-2 border-t border-white/[0.06] p-3 sm:p-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask something…"
          rows={1}
          className="max-h-32 flex-1 resize-none overflow-y-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <Button type="button" onClick={send} disabled={sending || !input.trim()} className="px-4 py-2.5">
          <SendIcon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
}
