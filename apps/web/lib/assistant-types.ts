// Mirrors apps/api/src/modules/assistant (APPROACH.md §19).

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// GET /assistant/messages's shape — one page of 10, oldest-first, plus
// whether an older page still exists (for the scroll-up-to-load-more UI).
export interface ChatMessagesPage {
  messages: ChatMessage[];
  hasMore: boolean;
}
