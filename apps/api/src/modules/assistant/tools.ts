import * as notesService from '../notes/service.js';
import * as progressService from '../progress/service.js';
import * as portfolioService from '../portfolio/service.js';
import * as expensesService from '../expenses/service.js';
import type { TypeFilter } from '../expenses/repository.js';

// OpenAI-compatible "tools" shape (freellmapi's /v1/chat/completions is an
// OpenAI-compatible endpoint — APPROACH.md §19) — plain JSON Schema
// `parameters`, not Gemini's `Type` enum.
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// The model only ever sees these declarations — no update/delete tool
// exists, and none of them takes a userId argument (APPROACH.md §19).
// `userId` below always comes from the authenticated session in
// service.ts, never from the model. The expense tools are read-only too —
// updateExpense/deleteExpense/importExpenses (expenses/service.ts) are
// deliberately never wrapped here, same as notes/progress/portfolio.

export const TOOL_DECLARATIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: "Search the user's own notes by title/content substring. Omit query to list all notes.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to search for in note titles/snippets (optional).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_note_detail',
      description: 'Fetch the full plain-text content of one note by id (ids come from search_notes results).',
      parameters: {
        type: 'object',
        properties: {
          noteId: { type: 'string', description: 'The note id to fetch.' },
        },
        required: ['noteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_summary',
      description:
        "Get the user's Progress Tracker attention summary: daily habits not done today, stale study-plan topics, items due soon, stale interviews/other items, and open 'other' items.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_progress_items',
      description:
        "List the user's Progress Tracker items (habits, study plans, interviews, or any user-defined category). Optionally filter by exact type.",
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description:
              "Exact type to filter by, e.g. 'daily', 'study_plan', 'interview', 'other', or any user-defined category string. Omit to list everything.",
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_portfolio_items',
      description:
        "List the user's Portfolio sections and items — links, documents, and contact-style text fields (e.g. GitHub, resume, phone number).",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_expense_summary',
      description:
        "Get the user's Expense Tracker totals — income, expense, net, and running balance — plus their top merchants by spend, optionally over a date range. Omit from/to for all-time.",
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date, inclusive, as YYYY-MM-DD (optional).' },
          to: { type: 'string', description: 'End date, inclusive, as YYYY-MM-DD (optional).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_expenses',
      description:
        "Search the user's logged bank transactions. Filter by a substring of details/counterparty/merchant, by debit/credit, and/or by date range. Returns the most recent matches first, capped to a small page.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to search for in details/counterparty/merchant name (optional).' },
          type: { type: 'string', enum: ['all', 'debit', 'credit'], description: "Transaction type filter (default 'all')." },
          from: { type: 'string', description: 'Start date, inclusive, as YYYY-MM-DD (optional).' },
          to: { type: 'string', description: 'End date, inclusive, as YYYY-MM-DD (optional).' },
        },
      },
    },
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
    case 'get_expense_summary': {
      const from = typeof args.from === 'string' ? args.from : undefined;
      const to = typeof args.to === 'string' ? args.to : undefined;
      const { stats, topMerchants } = await expensesService.getChartData(userId, { from, to });
      // `days`/`monthly` omitted deliberately — a full daily series would
      // dwarf the rest of the context for a question that only needs the
      // totals; the model can ask search_expenses for specific rows.
      return { stats, topMerchants: topMerchants.slice(0, 10) };
    }
    case 'search_expenses': {
      const query = typeof args.query === 'string' ? args.query : undefined;
      const type = (typeof args.type === 'string' ? args.type : 'all') as TypeFilter;
      const from = typeof args.from === 'string' ? args.from : undefined;
      const to = typeof args.to === 'string' ? args.to : undefined;
      // Capped page size (one of ALLOWED_PAGE_SIZES) regardless of what
      // the model asks for — this is a chat context, not the full ledger
      // view, so a large result set would just waste tokens either way.
      const { rows, total } = await expensesService.listExpenses(userId, {
        search: query,
        type,
        from,
        to,
        pageSize: 20,
      });
      return {
        total,
        shown: rows.length,
        rows: rows.map((r) => ({
          date: r.date,
          details: r.details,
          debit: r.debit,
          credit: r.credit,
          balance: r.balance,
          counterpartyName: r.counterparty_name,
          merchantName: r.merchant_name,
        })),
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
