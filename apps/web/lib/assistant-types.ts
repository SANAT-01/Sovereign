// Mirrors apps/api/src/modules/assistant (APPROACH.md §19).

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
