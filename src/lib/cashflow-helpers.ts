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
  detectedColumns: { dateKey?: string; amountKey?: string; descKey?: string };
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
export type DateFormatHint = "br" | "us" | "iso" | "auto";

export function parseDateSmart(input: unknown, hint: DateFormatHint = "auto"): string | null {
  if (input == null || input === "") return null;

  if (typeof input === "number" && Number.isFinite(input)) {
    const d = XLSX.SSF.parse_date_code(input);
    if (d && d.y) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // ISO YYYY-MM-DD (always unambiguous)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // Numeric DD?/DD?/YYYY with separator / - .
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(str);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    let y = m[3];
    if (y.length === 2) y = `20${y}`;

    // Decide order
    let day: number, month: number;
    if (hint === "us") {
      month = a; day = b;
    } else if (hint === "br") {
      day = a; month = b;
    } else {
      // auto: use disambiguating values
      if (a > 12 && b <= 12) { day = a; month = b; }
      else if (b > 12 && a <= 12) { month = a; day = b; }
      else { day = a; month = b; } // tie → BR default
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const t = Date.parse(str);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}

/** Inspect a column of date strings to decide BR vs US format. */
function detectDateFormat(samples: unknown[]): DateFormatHint {
  let brEvidence = 0;
  let usEvidence = 0;
  for (const v of samples) {
    if (v == null || v === "") continue;
    const s = String(v).trim();
    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12 && b <= 12) brEvidence++; // first part can only be day
    else if (b > 12 && a <= 12) usEvidence++; // second part can only be day
  }
  if (usEvidence > brEvidence) return "us";
  if (brEvidence > 0) return "br";
  return "auto";
}

export function parseAmount(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  // strip surrounding quotes
  s = s.replace(/^["']|["']$/g, "").trim();
  s = s.replace(/[R$€£¥]/gi, "").replace(/\s/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Decide which is decimal: the rightmost one
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // BR: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma → if it looks like a decimal (1-2 digits after) treat as decimal, else thousands
    if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    // Only dot → if format is .ddd (3 digits) treat as thousands, else decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }

  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function inferDirection(value: unknown, hint?: string): CashflowDirection {
  if (hint) {
    const h = hint.toLowerCase().trim();
    if (/^[ce]$|cred|entrada|inflow|receit|receb|^\+/i.test(h)) return "inflow";
    if (/^[ds]$|deb|saida|saída|outflow|despes|paga|^-/i.test(h)) return "outflow";
  }
  const n = typeof value === "number" ? value : parseAmount(value) ?? 0;
  return n < 0 ? "outflow" : "inflow";
}

// ============ Column mapping (intelligent) ============
const COLUMN_MAP: Record<keyof Omit<ParsedRow, "rowIndex" | "errors">, string[]> = {
  forecast_date: [
    "data", "date", "vencimento", "duedate", "due_date", "dt_vencto", "dtvencto",
    "data prevista", "dataprevista", "data vencimento", "datavencimento",
    "data pagamento", "datapagamento", "competencia", "competência", "dia",
    "data_lancamento", "datalancamento",
  ],
  amount: [
    "valor", "amount", "value", "montante", "total", "preço", "preco",
    "valortotal", "valor total", "vlr", "vl", "quantia",
    "valor previsto", "valorprevisto", "r$", "valor (r$)",
  ],
  description: [
    "descrição", "descricao", "description", "histórico", "historico", "memo",
    "lançamento", "lancamento", "title", "titulo", "título", "nome",
    "detalhe", "detalhes", "descricao do lancamento",
  ],
  document_number: [
    "documento", "doc", "document", "nf", "boleto", "ref", "referência", "referencia",
    "numero", "número", "nfe", "ndoc",
  ],
  category: [
    "categoria", "category", "classe", "grupo", "plano de contas", "planodecontas",
    "centro de custo", "centrocusto",
  ],
  direction: [
    "tipo", "type", "direction", "natureza", "movimento", "operacao", "operação",
    "entrada/saida", "credito/debito", "credebito",
  ],
  notes: [
    "obs", "observação", "observacao", "observações", "observacoes",
    "notas", "notes", "comentário", "comentario",
  ],
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
  const normalizedCands = candidates.map(normalizeKey);
  for (const cand of normalizedCands) {
    const hit = keys.find((k) => normalizeKey(k) === cand);
    if (hit) return hit;
  }
  for (const cand of normalizedCands) {
    const hit = keys.find((k) => normalizeKey(k).includes(cand));
    if (hit) return hit;
  }
  return null;
}

/** Heuristic content-based column detection as fallback. */
function detectColumnsByContent(rows: Record<string, unknown>[]): {
  dateKey?: string;
  amountKey?: string;
  descKey?: string;
} {
  if (rows.length === 0) return {};
  const sample = rows.slice(0, Math.min(20, rows.length));
  const keys = Object.keys(rows[0]);
  const scores: Record<string, { date: number; amount: number; len: number; nonEmpty: number }> = {};

  for (const k of keys) {
    scores[k] = { date: 0, amount: 0, len: 0, nonEmpty: 0 };
    for (const row of sample) {
      const v = row[k];
      if (v == null || v === "") continue;
      scores[k].nonEmpty++;
      if (parseDateSmart(v)) scores[k].date++;
      const num = parseAmount(v);
      if (num != null && /[\d]/.test(String(v))) scores[k].amount++;
      const s = String(v).trim();
      if (s.length > 3 && /[a-zA-ZÀ-ÿ]/.test(s)) scores[k].len += s.length;
    }
  }

  const pickBest = (metric: "date" | "amount" | "len") => {
    let best: string | undefined;
    let bestScore = 0;
    for (const k of keys) {
      if (scores[k][metric] > bestScore) {
        bestScore = scores[k][metric];
        best = k;
      }
    }
    return best;
  };

  const dateKey = pickBest("date");
  const amountKey = pickBest("amount");
  let descKey = pickBest("len");
  if (descKey && (descKey === dateKey || descKey === amountKey)) {
    descKey = Object.keys(scores).find((k) => k !== dateKey && k !== amountKey && scores[k].len > 0);
  }

  return { dateKey, amountKey, descKey };
}

interface MapContext {
  dateKey?: string;
  amountKey?: string;
  descKey?: string;
  dateFormat?: DateFormatHint;
}

function mapRow(
  raw: Record<string, unknown>,
  idx: number,
  ctx: MapContext = {},
): ParsedRow {
  const errors: string[] = [];
  const dateKey = findColumnKey(raw, COLUMN_MAP.forecast_date) ?? ctx.dateKey;
  const amountKey = findColumnKey(raw, COLUMN_MAP.amount) ?? ctx.amountKey;
  const descKey = findColumnKey(raw, COLUMN_MAP.description) ?? ctx.descKey;
  const docKey = findColumnKey(raw, COLUMN_MAP.document_number);
  const catKey = findColumnKey(raw, COLUMN_MAP.category);
  const dirKey = findColumnKey(raw, COLUMN_MAP.direction);
  const notesKey = findColumnKey(raw, COLUMN_MAP.notes);

  const date = dateKey ? parseDateSmart(raw[dateKey], ctx.dateFormat ?? "auto") : null;
  const amount = amountKey ? parseAmount(raw[amountKey]) : null;
  const desc = descKey ? String(raw[descKey] ?? "").trim() : "";

  if (!date) {
    errors.push(
      dateKey
        ? `Data inválida na coluna "${dateKey}" (valor: "${String(raw[dateKey] ?? "")}")`
        : `Coluna de data não identificada. Renomeie para "data" ou "vencimento"`,
    );
  }
  if (amount == null) {
    errors.push(
      amountKey
        ? `Valor inválido na coluna "${amountKey}" (valor: "${String(raw[amountKey] ?? "")}")`
        : `Coluna de valor não identificada. Renomeie para "valor"`,
    );
  } else if (amount === 0) {
    errors.push(`Valor zero na coluna "${amountKey}" — linha ignorada`);
  }
  if (!desc) {
    // Auto-fallback: combine first non-empty text columns
    const fallback = Object.entries(raw)
      .filter(([k, v]) => k !== dateKey && k !== amountKey && v != null && String(v).trim() !== "" && /[a-zA-ZÀ-ÿ]/.test(String(v)))
      .slice(0, 2)
      .map(([, v]) => String(v).trim())
      .join(" — ");
    if (fallback) {
      // accept fallback silently
      return finishRow(idx, raw, dateKey, amountKey, fallback, docKey, catKey, dirKey, notesKey, date, amount, errors);
    }
    errors.push(
      descKey
        ? `Descrição vazia na coluna "${descKey}"`
        : `Coluna de descrição não identificada`,
    );
  }

  return finishRow(idx, raw, dateKey, amountKey, desc, docKey, catKey, dirKey, notesKey, date, amount, errors);
}

function finishRow(
  idx: number,
  raw: Record<string, unknown>,
  dateKey: string | undefined,
  amountKey: string | undefined,
  desc: string,
  docKey: string | null,
  catKey: string | null,
  dirKey: string | null,
  notesKey: string | null,
  date: string | null,
  amount: number | null,
  errors: string[],
): ParsedRow {
  const dirHint = dirKey ? String(raw[dirKey] ?? "") : undefined;
  const direction = inferDirection(amount, dirHint);

  return {
    rowIndex: idx + 2,
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
function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const c of candidates) {
    const escaped = c === "\t" ? "\\t" : `\\${c}`;
    const count = (firstLine.match(new RegExp(escaped, "g")) ?? []).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function readCSVText(text: string): Record<string, unknown>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const sep = detectSeparator(clean);
  const wb = XLSX.read(clean, { type: "string", FS: sep, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

export async function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  return readCSVText(text);
}

export async function parseXLSX(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

export async function parseGoogleSheetsURL(url: string): Promise<Record<string, unknown>[]> {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error("URL do Google Sheets inválida");
  const id = m[1];
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("Falha ao baixar planilha. Verifique se está pública (leitura).");
  const text = await res.text();
  return readCSVText(text);
}

// ============ Duplicate detection ============
export async function buildPreview(
  rawRows: Record<string, unknown>[],
  userId: string,
  empresaId: string | undefined,
): Promise<ImportPreview> {
  if (rawRows.length === 0) {
    return { rows: [], valid: [], invalid: [], duplicates: [], detectedColumns: {} };
  }

  // Auto-detect columns by content if header names are unknown
  const detected = detectColumnsByContent(rawRows);

  // Resolve final date column (header-based wins over heuristic)
  const firstRow = rawRows[0];
  const resolvedDateKey = findColumnKey(firstRow, COLUMN_MAP.forecast_date) ?? detected.dateKey;

  // Detect date format (BR vs US) by inspecting a sample of the date column
  const dateFormat: DateFormatHint = resolvedDateKey
    ? detectDateFormat(rawRows.slice(0, 30).map((r) => r[resolvedDateKey]))
    : "auto";

  const parsed = rawRows.map((r, i) => mapRow(r, i, { ...detected, dateFormat }));

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

  return { rows: parsed, valid, invalid, duplicates, detectedColumns: detected };
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
