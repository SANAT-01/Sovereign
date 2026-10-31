"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "../ui/Button";
import {
  ArrowLeftIcon,
  HeadingIcon,
  BulletListIcon,
  OrderedListIcon,
  QuoteIcon,
  LinkIcon,
  ClearFormatIcon,
  TrashIcon,
} from "../ui/icons";
import type { Note } from "@/lib/notes-types";

type SaveStatus = "idle" | "saving" | "saved";

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-slate-400 hover:bg-white/8 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function NotesEditor({
  note,
  saveStatus,
  onChangeTitle,
  onChangeContent,
  onManualSave,
  onDelete,
  onBack,
}: {
  note: Note;
  saveStatus: SaveStatus;
  onChangeTitle: (title: string) => void;
  onChangeContent: (html: string) => void;
  onManualSave: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const lastLoadedNoteId = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: note.content,
    onUpdate: ({ editor }: { editor: Editor }) => onChangeContent(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "notes-editor-body flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 focus:outline-none",
      },
    },
  });

  // Tiptap's `content` prop isn't reactive — swap content explicitly when
  // switching to a *different* note, but never while still editing the
  // same one (that would reset the cursor mid-type).
  useEffect(() => {
    if (!editor || note.id === lastLoadedNoteId.current) return;
    lastLoadedNoteId.current = note.id;
    editor.commands.setContent(note.content);
  }, [editor, note.id, note.content]);

  function insertLink() {
    if (!editor) return;
    const url = window.prompt("Link URL:", "https://");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  const statusColor = saveStatus === "saving" ? "text-amber-400" : saveStatus === "saved" ? "text-accent" : "text-slate-500";
  const statusDot = saveStatus === "saving" ? "bg-amber-400" : saveStatus === "saved" ? "bg-accent" : "bg-slate-500";
  const statusText =
    saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved just now" : "No changes yet";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white lg:hidden">
          <ArrowLeftIcon width={18} height={18} />
          <span className="text-sm">Notes</span>
        </button>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {statusText}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDelete}
            title="Delete note"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/20 bg-red-400/5 text-red-400/80 transition-colors hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-400"
          >
            <TrashIcon width={16} height={16} />
          </button>
          <Button type="button" variant="accent" className="px-3.5 py-2 text-sm" onClick={onManualSave}>
            Save
          </Button>
        </div>
      </div>

      <input
        value={note.title}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder="Untitled note"
        className="border-none bg-transparent px-4 pt-4 text-xl font-semibold text-white outline-none placeholder:text-slate-600 sm:px-5 sm:text-2xl"
      />

      <div className="mt-3 flex flex-wrap items-center gap-0.5 border-y border-white/[0.06] px-3 py-2 sm:px-4">
        <ToolbarButton title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton
          title="Heading"
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <HeadingIcon width={16} height={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon width={16} height={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListIcon width={16} height={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon width={16} height={16} />
        </ToolbarButton>
        <ToolbarButton title="Link" active={editor?.isActive("link")} onClick={insertLink}>
          <LinkIcon width={16} height={16} />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton title="Clear formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>
          <ClearFormatIcon width={16} height={16} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col text-sm text-slate-200 sm:text-[0.95rem]" />
    </div>
  );
}
