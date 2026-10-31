# Component Patterns

## Shared vs. module-specific
```
/apps/web/components/
  ui/              → shared primitives: Button, Input, Select, Modal, Card, PageLayout
/app/(modules)/expenses/components/   → expense-specific: ExpenseRow, CategoryPicker
/app/(modules)/notes/components/      → note-specific: NoteEditor, TagList
```
A component goes in `components/ui/` only once it's used by (or clearly will be used by) more than one module. Don't pre-emptively generalize a component used by exactly one module today — that's premature abstraction. Move it to `ui/` the moment a second module needs the same thing.

## Composition over duplication
If `ExpenseRow` and a future `TaskRow` (progress module) end up looking 80% similar, don't copy-paste — extract the shared 80% into a `ui/` primitive (e.g. a generic `ListRow` with slots for icon/title/trailing content) and let each module compose it with its own specifics:
```tsx
// ui/ListRow.tsx — shared
export function ListRow({ icon, title, subtitle, trailing }: ListRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}

// expenses/components/ExpenseRow.tsx — module-specific composition
export function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <ListRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.category}
      subtitle={formatDate(expense.createdAt)}
      trailing={<span className="font-mono">${expense.amount}</span>}
    />
  );
}
```

## Props, not business logic, decide rendering
A component receives the answer, it doesn't compute it:
```tsx
// BAD — component deciding a business rule
function ExpenseRow({ expense }) {
  const isEditable = Date.now() - expense.createdAt < 30 * 24 * 60 * 60 * 1000; // business rule, belongs in service.ts
  ...
}

// GOOD — backend already decided, component just renders
function ExpenseRow({ expense }) {
  // expense.isEditable comes from the API response, computed in service.ts
  return <button disabled={!expense.isEditable}>Edit</button>;
}
```

## Data fetching stays out of leaf components
Fetch at the page/route level (Server Component for SSR, or a hook at the top of a module's page for CSR) and pass data down as props — don't scatter `fetch`/`useQuery` calls inside deeply nested presentational components. Keeps components easy to reuse and test in isolation.
