import { Type, type FunctionDeclaration } from '@google/genai';
import * as notesService from '../notes/service.js';
import * as progressService from '../progress/service.js';
import * as portfolioService from '../portfolio/service.js';

// The model only ever sees these five declarations — no update/delete
// tool exists, and none of them takes a userId argument (APPROACH.md
// §19). `userId` below always comes from the authenticated session in
// service.ts, never from the model.

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_notes',
    description: "Search the user's own notes by title/content substring. Omit query to list all notes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Substring to search for in note titles/snippets (optional).' },
      },
    },
  },
  {
    name: 'get_note_detail',
    description: 'Fetch the full plain-text content of one note by id (ids come from search_notes results).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        noteId: { type: Type.STRING, description: 'The note id to fetch.' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'get_progress_summary',
    description:
      "Get the user's Progress Tracker attention summary: daily habits not done today, stale study-plan topics, items due soon, stale interviews/other items, and open 'other' items.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'list_progress_items',
    description:
      "List the user's Progress Tracker items (habits, study plans, interviews, or any user-defined category). Optionally filter by exact type.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description:
            "Exact type to filter by, e.g. 'daily', 'study_plan', 'interview', 'other', or any user-defined category string. Omit to list everything.",
        },
      },
    },
  },
  {
    name: 'list_portfolio_items',
    description:
      "List the user's Portfolio sections and items — links, documents, and contact-style text fields (e.g. GitHub, resume, phone number).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function runTool(userId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_notes': {
      const notes = await notesService.listNotes(userId);
      const query = typeof args.query === 'string' ? args.query.toLowerCase() : '';
      const filtered = query
        ? notes.filter((n) => n.title.toLowerCase().includes(query) || n.snippet.toLowerCase().includes(query))
        : notes;
      return filtered.map((n) => ({ id: n.id, title: n.title, snippet: n.snippet, updatedAt: n.updatedAt }));
    }
    case 'get_note_detail': {
      const noteId = String(args.noteId ?? '');
      try {
        const note = await notesService.getNote(userId, noteId);
        return { id: note.id, title: note.title, content: stripHtml(note.content) };
      } catch {
        return { error: 'Note not found.' };
      }
    }
    case 'get_progress_summary': {
      return progressService.getDashboard(userId);
    }
    case 'list_progress_items': {
      const items = await progressService.listItems(userId);
      const type = typeof args.type === 'string' ? args.type : undefined;
      const filtered = type ? items.filter((i) => i.type === type) : items;
      // listItems's return type varies per item (daily/study_plan get
      // extra enriched fields) — a plain passthrough object for the
      // model, not internal logic, so a loose cast here is fine.
      return filtered.map((i) => {
        const enriched = i as typeof i & { streak?: number; doneToday?: boolean; coveragePercent?: number | null };
        return {
          id: enriched.id,
          type: enriched.type,
          title: enriched.title,
          status: enriched.status,
          dueAt: enriched.due_at,
          data: enriched.data,
          streak: enriched.streak,
          doneToday: enriched.doneToday,
          coveragePercent: enriched.coveragePercent,
        };
      });
    }
    case 'list_portfolio_items': {
      const sections = await portfolioService.getBoard(userId);
      return sections.map((s) => ({
        section: s.title,
        items: s.items.map((i) => ({ kind: i.kind, label: i.label, value: i.value, note: i.note, pinned: i.pinned })),
      }));
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
