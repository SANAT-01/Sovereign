import { db } from '../../db/client.js';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: Date;
}

export async function listMessages(userId: string, limit: number): Promise<ChatMessage[]> {
  const result = await db.query<ChatMessage>(
    `SELECT * FROM (
       SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
     ) recent ORDER BY created_at ASC`,
    [userId, limit],
  );
  return result.rows;
}

// Same "most recent N, re-sorted ascending" shape as listMessages, plus an
// optional `before` cursor (the oldest `created_at` already loaded in the
// UI) so scrolling up fetches the next older page instead of the same
// newest N every time. Kept separate from listMessages (used only to
// build the LLM's own context window in service.ts's sendMessage) so
// changing the UI's page size never changes how much history the model sees.
export async function listMessagesPage(userId: string, limit: number, before?: Date): Promise<ChatMessage[]> {
  const result = before
    ? await db.query<ChatMessage>(
        `SELECT * FROM (
           SELECT * FROM chat_messages WHERE user_id = $1 AND created_at < $3 ORDER BY created_at DESC LIMIT $2
         ) page ORDER BY created_at ASC`,
        [userId, limit, before],
      )
    : await db.query<ChatMessage>(
        `SELECT * FROM (
           SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
         ) page ORDER BY created_at ASC`,
        [userId, limit],
      );
  return result.rows;
}

export async function appendMessage(userId: string, role: ChatRole, content: string): Promise<ChatMessage> {
  const result = await db.query<ChatMessage>(
    `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3) RETURNING *`,
    [userId, role, content],
  );
  return result.rows[0];
}

export async function clearMessages(userId: string): Promise<void> {
  await db.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
}
