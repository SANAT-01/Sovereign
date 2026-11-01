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
