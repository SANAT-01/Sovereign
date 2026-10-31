# Query Patterns

## Where these concerns live
All of the below happen in `repository.ts` — `service.ts` calls repository functions and gets back plain data, it doesn't know about SQL, joins, or pagination mechanics.

## N+1 avoidance
Don't loop over a list and issue one query per item:
```ts
// BAD — N+1
const notes = await repository.listNotes(userId);
for (const note of notes) {
  note.tags = await repository.getTagsForNote(note.id); // one query per note
}
```
Instead, join or batch-fetch:
```ts
// GOOD — one query with a join, or one batched IN query
const notesWithTags = await db.query(`
  SELECT n.*, array_agg(t.name) AS tags
  FROM notes_entries n
  LEFT JOIN notes_entry_tags et ON et.entry_id = n.id
  LEFT JOIN notes_tags t ON t.id = et.tag_id
  WHERE n.user_id = $1
  GROUP BY n.id
`, [userId]);
```

## Pagination
Prefer keyset (cursor-based) pagination over `OFFSET` once a list can grow large — `OFFSET` gets slower as the offset grows and is prone to skipped/duplicated rows if data changes between pages. For this project's current scale (personal data), simple `LIMIT`/`OFFSET` is fine to start; switch to a cursor (`WHERE created_at < $lastSeenCreatedAt ORDER BY created_at DESC LIMIT 20`) if a listing ever needs to handle real growth.

## Transactions
Wrap multi-statement writes that must succeed or fail together in a transaction:
```ts
export async function transferCategory(userId: string, fromCategory: string, toCategory: string) {
  return db.transaction(async (tx) => {
    await tx.query(`UPDATE expenses_transactions SET category = $1 WHERE user_id = $2 AND category = $3`,
      [toCategory, userId, fromCategory]);
    await tx.query(`DELETE FROM expenses_categories WHERE user_id = $1 AND name = $2`,
      [userId, fromCategory]);
  });
}
```
If one statement fails, the whole operation rolls back — don't leave the database in a half-updated state for anything that touches more than one table/row set as a logical unit.

## Always scope by user_id
Every query against a user-owned table filters by `user_id` — never rely on the application layer alone to enforce ownership. This is the actual data-isolation mechanism for a multi-user system; a missing `WHERE user_id = $1` is a direct cross-user data leak, not a minor bug.
