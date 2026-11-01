import { Pool, types, type QueryResultRow } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/multi_purpose';

// pg's default DATE parser (oid 1082) returns a JS Date at local midnight,
// which shifts the calendar day when later serialized to ISO depending on
// the server's timezone vs UTC (found via expenses' `date` column —
// APPROACH.md §20). A DATE has no time component, so there's nothing a
// Date object adds here — keep it as the plain 'YYYY-MM-DD' string Postgres
// already sends.
types.setTypeParser(1082, (value) => value);

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
