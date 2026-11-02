"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Assistant replies come back as markdown (headings, bold, lists, tables —
// see APPROACH.md §19's system prompt) — rendered here instead of as raw
// text so `**bold**`/`### heading`/`| table |` syntax doesn't show up
// literally in the chat bubble. User messages are left as plain text
// (ChatBoard.tsx) since they're raw input, not model output.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="mb-2 mt-1 text-base font-semibold text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-1 text-sm font-semibold text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-1 text-sm font-semibold text-white">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  hr: () => <hr className="my-3 border-white/10" />,
  code: ({ children }) => (
    <code className="rounded bg-black/25 px-1 py-0.5 text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/25 p-2 text-[0.85em] last:mb-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-white/15 pl-3 text-slate-300 last:mb-0">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-[0.9em]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-white/15">{children}</thead>,
  th: ({ children }) => <th className="px-2 py-1 font-medium text-slate-300">{children}</th>,
  td: ({ children }) => <td className="border-t border-white/[0.06] px-2 py-1 align-top">{children}</td>,
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="[&_*]:break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
