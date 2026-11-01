"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import { SendIcon } from "../ui/icons";
import type { ChatMessage } from "@/lib/assistant-types";

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChatBoard({ initialMessages, hasGeminiApiKey }: { initialMessages: ChatMessage[]; hasGeminiApiKey: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");

    const optimisticUser: ChatMessage = {
      id: newLocalId(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setSending(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!hasGeminiApiKey && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 sm:mx-5">
          No Gemini API key set yet.{" "}
          <Link href="/profile" className="font-medium underline">
            Add one in Profile
          </Link>{" "}
          to start chatting.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Ask about your notes, progress, or portfolio — e.g. "What interviews do I have coming up?"
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
                    m.role === "user" ? "bg-accent text-surface" : "bg-white/[0.06] text-slate-100"
                  }`}
                >
                  {m.content}
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
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-400 sm:px-5">{error}</p>}

      <div className="flex items-end gap-2 border-t border-white/[0.06] p-3 sm:p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={hasGeminiApiKey ? "Ask something…" : "Add an API key in Profile first"}
          disabled={!hasGeminiApiKey}
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <Button type="button" onClick={send} disabled={!hasGeminiApiKey || sending || !input.trim()} className="px-4 py-2.5">
          <SendIcon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
}
