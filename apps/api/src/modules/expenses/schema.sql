-- Expense Tracker module (APPROACH.md §20), Phase 1: import & log.
-- One flat table — the app never parses raw bank-statement text itself
-- (that's done by the user's own Claude session into this exact shape
-- before import); this table just stores the result.

CREATE TABLE IF NOT EXISTS expenses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  details            TEXT NOT NULL DEFAULT '',
  ref_no             TEXT,
  debit              NUMERIC(14, 2),
  credit             NUMERIC(14, 2),
  balance            NUMERIC(14, 2) NOT NULL,
  counterparty_name  TEXT,
  upi_id             TEXT,
  merchant_name      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id, date DESC);
-- Backs the re-import dedupe key (date, debit, credit, balance) —
-- running balance is effectively unique per transaction in practice, and
-- ref_no is blank on most real UPI rows so it can't be part of the key.
CREATE INDEX IF NOT EXISTS idx_expenses_dedupe ON expenses(user_id, date, debit, credit, balance);
-- One per sortable column (repository.ts's listExpensesPaged) — without
-- these, sorting by anything other than date falls back to a sequential
-- scan + sort on every page request.
CREATE INDEX IF NOT EXISTS idx_expenses_debit ON expenses(user_id, debit);
CREATE INDEX IF NOT EXISTS idx_expenses_credit ON expenses(user_id, credit);
CREATE INDEX IF NOT EXISTS idx_expenses_balance ON expenses(user_id, balance);
CREATE INDEX IF NOT EXISTS idx_expenses_counterparty ON expenses(user_id, counterparty_name);
