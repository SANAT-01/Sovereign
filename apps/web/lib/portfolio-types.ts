// Mirrors apps/api/src/modules/portfolio (generic sections+items model, APPROACH.md §9).

export type ItemKind = "link" | "document" | "text";

export interface PortfolioItem {
  id: string;
  section_id: string;
  kind: ItemKind;
  label: string;
  value: string | null;
  note: string | null;
  pinned: boolean;
  position: number;
  created_at: string;
}

export interface PortfolioSection {
  id: string;
  title: string;
  position: number;
  created_at: string;
  items: PortfolioItem[];
}
