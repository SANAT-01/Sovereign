"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DownloadIcon, UploadIcon, TrashIcon, EditIcon, SearchIcon } from "../ui/icons";
import type { Expense, ImportResult, ExpensesListResponse } from "@/lib/expenses-types";

type SortColumn = "date" | "debit" | "credit" | "balance" | "counterparty_name";
type SortDirection = "asc" | "desc";
type TypeFilter = "all" | "debit" | "credit";
const PAGE_SIZES = [10, 20, 50, 100] as const;

function formatAmount(value: string | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface EditState {
  date: string;
  details: string;
  counterpartyName: string;
  upiId: string;
  merchantName: string;
  debit: string;
  credit: string;
}

function SortButton({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  align = "left",
}: {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (c: SortColumn) => void;
  align?: "left" | "right";
}) {
  const active = sortColumn === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`flex items-center gap-1 font-medium ${active ? "text-accent" : "text-slate-400 hover:text-slate-200"} ${
        align === "right" ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {label}
      <span className="text-[10px]">{active ? (sortDirection === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

export function ExpensesBoard({ initialData }: { initialData: ExpensesListResponse }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(initialData.pageSize as (typeof PAGE_SIZES)[number]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  // Import/edit success needs a re-fetch of the *current* page/filters —
  // bumping this flag re-runs the main fetch effect below without
  // changing any actual filter/sort/page state.
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Debounce the free-text search into its own committed value — every
  // other control (sort/type/date/page) fetches immediately on change.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // The single source of truth for what's on screen — one real API call
  // per combination of filters/sort/page, not a client-side recompute
  // over an already-fetched list.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: sortColumn,
      dir: sortDirection,
      type: typeFilter,
    });
    if (search) params.set("search", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    fetch(`/api/expenses?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: ExpensesListResponse) => setData(json))
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Failed to load expenses", err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [page, pageSize, sortColumn, sortDirection, typeFilter, search, dateFrom, dateTo, refreshFlag]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  }

  async function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/expenses/import", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setImportError(body.error ?? "Import failed.");
        return;
      }
      const result: ImportResult = await res.json();
      setImportResult(result);
      if (result.imported > 0) setRefreshFlag((f) => f + 1);
    } catch {
      setImportError("Couldn't reach the server — try again.");
    } finally {
      setImporting(false);
    }
  }

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setEditState({
      date: e.date,
      details: e.details,
      counterpartyName: e.counterparty_name ?? "",
      upiId: e.upi_id ?? "",
      merchantName: e.merchant_name ?? "",
      debit: e.debit ?? "",
      credit: e.credit ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit(id: string) {
    if (!editState) return;
    const patch = {
      date: editState.date,
      details: editState.details,
      counterpartyName: editState.counterpartyName || null,
      upiId: editState.upiId || null,
      merchantName: editState.merchantName || null,
      debit: editState.debit ? Number(editState.debit) : null,
      credit: editState.credit ? Number(editState.credit) : null,
    };
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    cancelEdit();
    if (res.ok) setRefreshFlag((f) => f + 1);
  }

  const hasFilters = Boolean(searchInput || typeFilter !== "all" || dateFrom || dateTo);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/expenses/template">
          <Button type="button" variant="secondary">
            <DownloadIcon width={16} height={16} />
            Download template
          </Button>
        </a>
        <Button type="button" onClick={handleImportClick} disabled={importing}>
          <UploadIcon width={16} height={16} />
          {importing ? "Importing…" : "Import .xlsx"}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
      </div>

      {importError && <p className="mt-3 text-sm text-red-400">{importError}</p>}
      {importResult && (
        <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-2.5 text-sm text-accent">
          Imported {importResult.imported}, skipped {importResult.skipped} already-imported transaction
          {importResult.skipped === 1 ? "" : "s"}.
          {importResult.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-amber-300">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filters — each change fetches its own page from the server. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search details, counterparty…"
            className="w-56 rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-white/5 p-1">
          {(["all", "debit", "credit"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTypeFilter(t);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                typeFilter === t ? "bg-accent text-surface" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setTypeFilter("all");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
            className="text-xs text-slate-500 underline hover:text-slate-300"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {loading ? "Loading…" : `${data.total} transaction${data.total === 1 ? "" : "s"}`}
        </span>
      </div>

      <Card variant="solid" className="mt-3 overflow-x-auto p-0">
        {data.rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            {data.total === 0 && !hasFilters
              ? "No transactions yet — download the template, hand it plus your bank statement to your own Claude session, and import the result."
              : "No transactions match these filters."}
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">
                  <SortButton column="date" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3">
                  <SortButton
                    column="counterparty_name"
                    label="Counterparty"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    column="debit"
                    label="Debit"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    column="credit"
                    label="Credit"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    column="balance"
                    label="Balance"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
              {data.rows.map((e) =>
                editingId === e.id && editState ? (
                  <tr key={e.id} className="border-b border-white/[0.06] bg-white/[0.03] last:border-b-0">
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editState.date}
                        onChange={(ev) => setEditState({ ...editState, date: ev.target.value })}
                        className="w-32 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editState.details}
                        onChange={(ev) => setEditState({ ...editState, details: ev.target.value })}
                        className="w-full min-w-[160px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editState.counterpartyName}
                        onChange={(ev) => setEditState({ ...editState, counterpartyName: ev.target.value })}
                        placeholder="Counterparty"
                        className="w-full min-w-[120px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editState.debit}
                        onChange={(ev) => setEditState({ ...editState, debit: ev.target.value })}
                        placeholder="—"
                        className="w-24 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editState.credit}
                        onChange={(ev) => setEditState({ ...editState, credit: ev.target.value })}
                        placeholder="—"
                        className="w-24 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">{formatAmount(e.balance)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={cancelEdit}>
                        Cancel
                      </Button>
                      <Button type="button" variant="secondary" className="ml-1 px-2 py-1 text-xs" onClick={() => saveEdit(e.id)}>
                        Save
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatDate(e.date)}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-slate-200" title={e.details}>
                      {e.details || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {e.counterparty_name || "—"}
                      {e.merchant_name && e.merchant_name !== e.counterparty_name && (
                        <span className="ml-1 text-xs text-slate-500">({e.merchant_name})</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-red-300">
                      {e.debit ? formatAmount(e.debit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-300">
                      {e.credit ? formatAmount(e.credit) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-white">{formatAmount(e.balance)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled
                        title="Edit disabled for now"
                        className="cursor-not-allowed text-slate-700 opacity-50"
                      >
                        <EditIcon width={15} height={15} />
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Delete disabled for now"
                        className="ml-2 cursor-not-allowed text-slate-700 opacity-50"
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
              setPage(1);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size} className="bg-surface-card text-white">
                {size}
              </option>
            ))}
          </select>
          {data.totalPages > 1 && (
            <span>
              · Page {data.page} of {data.totalPages}
            </span>
          )}
        </div>
        {data.totalPages > 1 && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
