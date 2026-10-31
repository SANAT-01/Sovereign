import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/multi_purpose';

export const pool = new Pool({ connectionString: DATABASE_URL });

// Minimal shared query helper. Each module's repository.ts is the only place
// that should import this and build SQL against its own tables.
export const db = {
  query: <T = unknown>(text: string, params?: unknown[]) => pool.query<T>(text, params),
};
