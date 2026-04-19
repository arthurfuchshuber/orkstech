import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export type CashflowDirection = "inflow" | "outflow";
export type CashflowSource = "manual" | "csv" | "xlsx" | "google_sheets" | "system";
export type CashflowStatus = "forecast" | "confirmed" | "cancelled" | "reconciled";

export interface ParsedRow {
  rowIndex: number;
  direction: CashflowDirection;
  forecast_date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  document_number?: string;
  category?: string;
  notes?: string;
  errors?: string[];
}

export interface ImportPreview {
  rows: ParsedRow[];
  duplicates: Array<ParsedRow & { duplicateOf: { table: string; id: string; description: string } }>;
  invalid: ParsedRow[];
  valid: ParsedRow[];
}

export interface ConsolidatedRow {
  movement_date: string;
  source_table: string;
  source_id: string;
  direction: CashflowDirection;
  amount: number;
  description: string;
  category: string | null;
  document_number: string | null;
  status: string;
  origin: string;
}

// ============ Date / amount parsers ============
export function parseDateSmart(input: unknown): string | null {
  if (input == null || input === "") return null;

  // Excel serial number
  if (typeof input === "number" && Number.isFinite(input)) {
    const d = XLSX.SSF.parse_date_code(input);
    if (d && d.y) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // ISO YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // BR DD/MM/YYYY or DD-MM-YYYY
  const br = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(str);
  if (br) {
    let y = br[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }

  // Fallback Date.parse
  const t = Date.parse(str);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}

export function parseAmount(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim().replace(/\s/g, "");
  // Remove currency
  s = s.replace(/[R$€£¥]/gi, "").replace(/\s/g, "");
  // Brazilian: 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(s) && /\./.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{1,2}$/.test(s)) {
    s = s.replace(",", ".");
  }
  // Negative parentheses (123)
  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function inferDirection(value: unknown, hint?: string): CashflowDirection {
  if (hint) {
    const h = hint.toLowerCase();
    if (/(entrada|inflow|cr[eé]dito|receit|receb)/i.test(h)) return "inflow";
    if (/(sa[ií]da|outflow|d[eé]bito|despes|paga)/i.test(h)) return "outflow";
  }
  const n = typeof value === "number" ? value : parseAmount(value) ?? 0;
  return n < 0 ? "outflow" : "inflow";
}

// ============ Column mapping (intelligent) ============
const COLUMN_MAP: Record<keyof Omit<ParsedRow, "rowIndex" | "errors">, string[]> = {
  forecast_date: ["data", "date", "vencimento", "due_date", "dt_vencto", "data prevista"],
  amount: ["valor", "amount", "value", "montante", "total", "preço", "preco"],
  description: ["descrição", "descricao", "description", "histórico", "historico", "memo", "lançamento", "lancamento", "title"],
  document_number: ["documento", "doc", "document", "nf", "boleto", "ref", "referência", "referencia"],
  category: ["categoria", "category", "classe", "grupo"],
  direction: ["tipo", "type", "direction", "natureza", "movimento"],
  notes: ["obs", "observação", "observacao", "notas", "notes", "comentário", "comentario"],
};

function normalizeKey(s: string) {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findColumnKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const candNorm = normalizeKey(cand);
    const hit = keys.find((k) => normalizeKey(k) === candNorm);
    if (hit) return hit;
  }
  // Partial match
  for (const cand of candidates) {
    const candNorm = normalizeKey(cand);
    const hit = keys.find((k) => normalizeKey(k).includes(candNorm));
    if (hit) return hit;
  }
  return null;
}

function mapRow(raw: Record<string, unknown>, idx: number): ParsedRow {
  const errors: string[] = [];
  const dateKey = findColumnKey(raw, COLUMN_MAP.forecast_date);
  const amountKey = findColumnKey(raw, COLUMN_MAP.amount);
  const descKey = findColumnKey(raw, COLUMN_MAP.description);
  const docKey = findColumnKey(raw, COLUMN_MAP.document_number);
  const catKey = findColumnKey(raw, COLUMN_MAP.category);
  const dirKey = findColumnKey(raw, COLUMN_MAP.direction);
  const notesKey = findColumnKey(raw, COLUMN_MAP.notes);

  const date = dateKey ? parseDateSmart(raw[dateKey]) : null;
  const amount = amountKey ? parseAmount(raw[amountKey]) : null;
  const desc = descKey ? String(raw[descKey] ?? "").trim() : "";

  if (!date) errors.push("Data ausente ou inválida");
  if (amount == null) errors.push("Valor ausente ou inválido");
  if (!desc) errors.push("Descrição ausente");

  const dirHint = dirKey ? String(raw[dirKey] ?? "") : undefined;
  const direction = inferDirection(amount, dirHint);

  return {
    rowIndex: idx + 2, // +2 for header row + 1-indexed
    direction,
    forecast_date: date ?? "",
    amount: amount != null ? Math.abs(amount) : 0,
    description: desc,
    document_number: docKey ? String(raw[docKey] ?? "").trim() || undefined : undefined,
    category: catKey ? String(raw[catKey] ?? "").trim() || undefined : undefined,
    notes: notesKey ? String(raw[notesKey] ?? "").trim() || undefined : undefined,
    errors: errors.length ? errors : undefined,
  };
}

// ============ File parsers ============
export async function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  // Use xlsx CSV parser for consistency
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

export async function parseXLSX(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

export async function parseGoogleSheetsURL(url: string): Promise<Record<string, unknown>[]> {
  // Convert any Sheets URL to CSV export URL
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error("URL do Google Sheets inválida");
  const id = m[1];
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("Falha ao baixar planilha. Verifique se está pública (leitura).");
  const text = await res.text();
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

// ============ Duplicate detection ============
export async function buildPreview(
  rawRows: Record<string, unknown>[],
  userId: string,
  empresaId: string | undefined,
): Promise<ImportPreview> {
  const parsed = rawRows.map((r, i) => mapRow(r, i));

  const valid: ParsedRow[] = [];
  const invalid: ParsedRow[] = [];
  const duplicates: ImportPreview["duplicates"] = [];

  for (const row of parsed) {
    if (row.errors?.length) {
      invalid.push(row);
      continue;
    }

    const { data, error } = await supabase.rpc("cashflow_check_duplicate", {
      p_user_id: userId,
      p_empresa_id: empresaId ?? null,
      p_direction: row.direction,
      p_date: row.forecast_date,
      p_amount: row.amount,
      p_description: row.description,
      p_document: row.document_number ?? null,
    });

    if (error) {
      invalid.push({ ...row, errors: [`Erro de duplicidade: ${error.message}`] });
      continue;
    }

    const dup = (data as Array<{ found: boolean; source_table: string; source_id: string; source_description: string }>)?.[0];
    if (dup?.found) {
      duplicates.push({
        ...row,
        duplicateOf: {
          table: dup.source_table,
          id: dup.source_id,
          description: dup.source_description,
        },
      });
    } else {
      valid.push(row);
    }
  }

  return { rows: parsed, valid, invalid, duplicates };
}

// ============ Persist import ============
export async function commitImport(params: {
  userId: string;
  empresaId?: string;
  filename: string;
  source: CashflowSource;
  sourceUrl?: string;
  preview: ImportPreview;
  includeDuplicates?: boolean;
}): Promise<{ importId: string; insertedCount: number }> {
  const { userId, empresaId, filename, source, sourceUrl, preview, includeDuplicates } = params;

  const { data: imp, error: impErr } = await supabase
    .from("cashflow_imports")
    .insert({
      user_id: userId,
      empresa_id: empresaId ?? null,
      filename,
      source,
      source_url: sourceUrl ?? null,
      total_rows: preview.rows.length,
      inserted_count: 0,
      duplicate_count: preview.duplicates.length,
      skipped_count: preview.invalid.length,
      errors: preview.invalid.map((r) => ({ row: r.rowIndex, errors: r.errors })) as any,
    })
    .select()
    .single();
  if (impErr || !imp) throw impErr ?? new Error("Falha ao registrar importação");

  const toInsert = [
    ...preview.valid,
    ...(includeDuplicates ? preview.duplicates : []),
  ];

  if (toInsert.length === 0) {
    return { importId: imp.id, insertedCount: 0 };
  }

  const records = toInsert.map((r) => ({
    user_id: userId,
    empresa_id: empresaId ?? null,
    direction: r.direction,
    forecast_date: r.forecast_date,
    amount: r.amount,
    description: r.description,
    document_number: r.document_number ?? null,
    category: r.category ?? null,
    source,
    status: "forecast" as const,
    import_id: imp.id,
    notes: r.notes ?? null,
  }));

  const { error: insErr, count } = await supabase
    .from("cashflow_forecasts")
    .insert(records as any, { count: "exact" });
  if (insErr) throw insErr;

  await supabase
    .from("cashflow_imports")
    .update({ inserted_count: count ?? records.length })
    .eq("id", imp.id);

  return { importId: imp.id, insertedCount: count ?? records.length };
}

// ============ Fetch consolidated ============
export async function fetchConsolidated(
  userId: string,
  empresaId: string | undefined,
  start: string,
  end: string,
): Promise<ConsolidatedRow[]> {
  const { data, error } = await supabase.rpc("cashflow_consolidated", {
    p_user_id: userId,
    p_empresa_id: empresaId ?? null,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []) as ConsolidatedRow[];
}

export async function fetchBankBalance(empresaId?: string): Promise<number> {
  let q = supabase.from("contas_bancarias").select("saldo_inicial, saldo_investimento").eq("ativo", true);
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce(
    (sum, r: any) => sum + Number(r.saldo_inicial ?? 0) + Number(r.saldo_investimento ?? 0),
    0,
  );
}

export function summarize(rows: ConsolidatedRow[]) {
  const inflow = rows.filter((r) => r.direction === "inflow").reduce((s, r) => s + Number(r.amount), 0);
  const outflow = rows.filter((r) => r.direction === "outflow").reduce((s, r) => s + Number(r.amount), 0);
  return { inflow, outflow, net: inflow - outflow };
}

export function buildDailySeries(rows: ConsolidatedRow[], startBalance: number) {
  const byDate = new Map<string, { inflow: number; outflow: number }>();
  for (const r of rows) {
    const cur = byDate.get(r.movement_date) ?? { inflow: 0, outflow: 0 };
    if (r.direction === "inflow") cur.inflow += Number(r.amount);
    else cur.outflow += Number(r.amount);
    byDate.set(r.movement_date, cur);
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  let acc = startBalance;
  return sorted.map(([date, v]) => {
    acc = acc + v.inflow - v.outflow;
    return { date, inflow: v.inflow, outflow: v.outflow, balance: acc };
  });
}
