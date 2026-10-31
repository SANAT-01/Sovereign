import { Pool, type QueryResultRow } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/multi_purpose';

export const pool = new Pool({ connectionString: DATABASE_URL });

// Minimal shared query helper. Each module's repository.ts is the only place
// that should import this and build SQL against its own tables.
//
// T extends QueryResultRow to match pg's own constraint on Pool#query — the
// previous unconstrained `T = unknown` failed that constraint silently and
// broke type inference for every caller (rows ended up typed `any`).
export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
    pool.query<T>(text, params),
};
