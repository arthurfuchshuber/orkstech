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

export interface ColumnMapping {
  dateKey?: string;
  amountKey?: string;
  descKey?: string;
  docKey?: string;
  catKey?: string;
  dirKey?: string;
  notesKey?: string;
  dateFormat?: DateFormatHint;
}

/** Validate that a column's content actually matches the expected field type. */
function validateColumnContent(
  rows: Record<string, unknown>[],
  key: string,
  field: keyof typeof COLUMN_MAP,
): boolean {
  const sample = rows.slice(0, Math.min(20, rows.length))
    .map((r) => r[key])
    .filter((v) => v != null && String(v).trim() !== "");

  if (sample.length === 0) return false;

  let hits = 0;
  for (const v of sample) {
    const s = String(v).trim();
    switch (field) {
      case "forecast_date":
        if (parseDateSmart(v)) hits++;
        break;
      case "amount": {
        const n = parseAmount(v);
        // must parse as number AND look numeric (avoid IDs/codes that happen to parse)
        if (n != null && /[\d.,\-+R$\s]/.test(s) && !/[a-zA-ZÀ-ÿ]{3,}/.test(s)) hits++;
        break;
      }
      case "description":
        // Has letters and reasonable text length (not a code/ID)
        if (s.length >= 3 && /[a-zA-ZÀ-ÿ]/.test(s) && (/\s/.test(s) || /[a-zA-ZÀ-ÿ]{4,}/.test(s))) hits++;
        break;
      case "direction":
        // Must look like entrada/saida, credit/debit, +/-, C/D, etc. — not random labels
        if (/^(entrada|saida|saída|inflow|outflow|credit|crédito|credito|debit|débito|debito|receita|despesa|c|d|e|s|\+|-)$/i.test(s)) hits++;
        break;
      case "document_number":
        // Numeric-ish short codes, NF-like patterns
        if (/^[\w\-./]{3,}$/.test(s) && /\d/.test(s)) hits++;
        break;
      case "category":
        // Short labels (not long sentences nor pure numbers)
        if (s.length >= 2 && s.length <= 60 && /[a-zA-ZÀ-ÿ]/.test(s)) hits++;
        break;
      case "notes":
        if (s.length >= 1) hits++;
        break;
    }
  }

  // Require at least 60% of non-empty samples to match the expected pattern
  return hits / sample.length >= 0.6;
}

/** Find a column matching by header AND validate by content. */
function findColumnKeyValidated(
  rows: Record<string, unknown>[],
  candidates: string[],
  field: keyof typeof COLUMN_MAP,
): string | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const keys = Object.keys(first);
  const normalizedCands = candidates.map(normalizeKey);

  // Pass 1: exact normalized header match + content validation
  for (const cand of normalizedCands) {
    const hit = keys.find((k) => normalizeKey(k) === cand);
    if (hit && validateColumnContent(rows, hit, field)) return hit;
  }
  // Pass 2: header substring match + content validation
  for (const cand of normalizedCands) {
    const hit = keys.find((k) => normalizeKey(k).includes(cand));
    if (hit && validateColumnContent(rows, hit, field)) return hit;
  }
  return null;
}

/** Auto-detect a complete mapping from raw rows (header + content heuristic). */
export function autoDetectMapping(rawRows: Record<string, unknown>[]): ColumnMapping {
  if (rawRows.length === 0) return {};
  const detected = detectColumnsByContent(rawRows);
  const dateKey = findColumnKeyValidated(rawRows, COLUMN_MAP.forecast_date, "forecast_date") ?? detected.dateKey;
  const amountKey = findColumnKeyValidated(rawRows, COLUMN_MAP.amount, "amount") ?? detected.amountKey;
  const descKey = findColumnKeyValidated(rawRows, COLUMN_MAP.description, "description") ?? detected.descKey;
  const docKey = findColumnKeyValidated(rawRows, COLUMN_MAP.document_number, "document_number") ?? undefined;
  const catKey = findColumnKeyValidated(rawRows, COLUMN_MAP.category, "category") ?? undefined;
  const dirKey = findColumnKeyValidated(rawRows, COLUMN_MAP.direction, "direction") ?? undefined;
  const notesKey = findColumnKeyValidated(rawRows, COLUMN_MAP.notes, "notes") ?? undefined;
  const dateFormat: DateFormatHint = dateKey
    ? detectDateFormat(rawRows.slice(0, 30).map((r) => r[dateKey]))
    : "auto";
  return { dateKey, amountKey, descKey, docKey, catKey, dirKey, notesKey, dateFormat };
}

function mapRow(
  raw: Record<string, unknown>,
  idx: number,
  ctx: ColumnMapping = {},
): ParsedRow {
  const errors: string[] = [];
  // ctx wins over auto-detection (manual override mode)
  const dateKey = ctx.dateKey ?? findColumnKey(raw, COLUMN_MAP.forecast_date);
  const amountKey = ctx.amountKey ?? findColumnKey(raw, COLUMN_MAP.amount);
  const descKey = ctx.descKey ?? findColumnKey(raw, COLUMN_MAP.description);
  const docKey = ctx.docKey ?? findColumnKey(raw, COLUMN_MAP.document_number);
  const catKey = ctx.catKey ?? findColumnKey(raw, COLUMN_MAP.category);
  const dirKey = ctx.dirKey ?? findColumnKey(raw, COLUMN_MAP.direction);
  const notesKey = ctx.notesKey ?? findColumnKey(raw, COLUMN_MAP.notes);

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
  // raw:false → values come as strings, preserving quoted "1,283.25"
  const wb = XLSX.read(clean, { type: "string", FS: sep, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
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
  mappingOverride?: ColumnMapping,
): Promise<ImportPreview> {
  if (rawRows.length === 0) {
    return { rows: [], valid: [], invalid: [], duplicates: [], detectedColumns: {} };
  }

  const mapping = mappingOverride ?? autoDetectMapping(rawRows);
  const parsed = rawRows.map((r, i) => mapRow(r, i, mapping));

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

  return {
    rows: parsed,
    valid,
    invalid,
    duplicates,
    detectedColumns: { dateKey: mapping.dateKey, amountKey: mapping.amountKey, descKey: mapping.descKey },
  };
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

export async function fetchBankBalance(empresaId?: string, userId?: string): Promise<number> {
  // 1) Contas bancárias manuais: saldo atual = saldo_inicial + Σ(entradas - saídas)
  //    + saldo_investimento (espelho do app do banco). Mesma fórmula do Dashboard Financeiro.
  let q = supabase
    .from("contas_bancarias")
    .select("id, saldo_inicial, saldo_investimento")
    .eq("ativo", true);
  if (empresaId) q = q.eq("empresa_id", empresaId);
  else if (userId) q = q.eq("user_id", userId);
  const { data: manuais, error } = await q;
  if (error) throw error;

  const manualIds = (manuais ?? []).map((r: any) => r.id);
  let movimentos: any[] = [];
  if (manualIds.length > 0) {
    let mq = supabase
      .from("cash_transactions")
      .select("amount, type, bank_account_id")
      .in("bank_account_id", manualIds);
    if (empresaId) mq = mq.eq("empresa_id", empresaId);
    else if (userId) mq = mq.eq("user_id", userId);
    const { data } = await mq;
    movimentos = data ?? [];
  }

  const saldoPorConta = new Map<string, number>();
  (manuais ?? []).forEach((r: any) => saldoPorConta.set(r.id, Number(r.saldo_inicial ?? 0)));
  movimentos.forEach((t: any) => {
    if (!t.bank_account_id) return;
    const cur = saldoPorConta.get(t.bank_account_id) ?? 0;
    const v = Number(t.amount ?? 0);
    saldoPorConta.set(t.bank_account_id, cur + (t.type === "entrada" ? v : -v));
  });

  const saldoManualContas = Array.from(saldoPorConta.values()).reduce((s, v) => s + v, 0);
  const saldoManualInvestimentos = (manuais ?? []).reduce(
    (sum, r: any) => sum + Number(r.saldo_investimento ?? 0),
    0,
  );

  // 2) Open Finance (Pluggy) — apenas contas BANK (exclui CREDIT, que tem card próprio)
  let pq = supabase
    .from("pluggy_bank_accounts")
    .select("balance, type, bank_data");
  if (userId) pq = pq.eq("user_id", userId);
  const { data: pluggy } = await pq;
  const pluggyBank = (pluggy ?? []).filter(
    (r: any) => String(r.type ?? "").toUpperCase() !== "CREDIT",
  );
  const saldoContasPluggy = pluggyBank.reduce((sum, r: any) => sum + Number(r.balance ?? 0), 0);

  // 3) Investimentos Pluggy: soma totalInvestments + automaticallyInvestedBalance
  //    (caixinhas/sub-contas de rendimento). Em alguns conectores essas caixinhas
  //    NÃO estão inclusas no `balance` da conta corrente — somamos para refletir o
  //    patrimônio líquido total da empresa, igual ao Dashboard 360.
  const saldoInvestPluggy = pluggyBank.reduce((sum, r: any) => {
    const bd = r.bank_data ?? {};
    return sum + Number(bd.totalInvestments ?? 0) + Number(bd.automaticallyInvestedBalance ?? 0);
  }, 0);

  return saldoManualContas + saldoManualInvestimentos + saldoContasPluggy + saldoInvestPluggy;
}

/**
 * Resume entradas/saídas separando o que já foi realizado (extrato bancário,
 * pagamentos confirmados) do que ainda é previsão (pendente/atrasado/forecast).
 *
 * Os KPIs "Entradas Previstas" e "Saídas Previstas" usam apenas o lado FORECAST,
 * para não inflar com transações Pluggy/cash já liquidadas no período.
 */
const REALIZED_STATUSES = new Set(["confirmed", "reconciled", "paid", "received", "settled"]);

export function summarize(rows: ConsolidatedRow[]) {
  let inflow = 0, outflow = 0, realizedInflow = 0, realizedOutflow = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    const realized = REALIZED_STATUSES.has(r.status);
    if (r.direction === "inflow") {
      if (realized) realizedInflow += amt; else inflow += amt;
    } else {
      if (realized) realizedOutflow += amt; else outflow += amt;
    }
  }
  return {
    inflow,           // apenas previstos (forecast/pending/overdue)
    outflow,          // apenas previstos
    realizedInflow,
    realizedOutflow,
    net: inflow - outflow,
  };
}

/**
 * Constrói série diária com separação realizado/projetado.
 *
 * Estratégia (modelo "Histórico + tudo"):
 * - `currentBalance`: saldo bancário consolidado de hoje.
 * - Calcula retroativamente o saldo no dia inicial do período removendo as
 *   movimentações realizadas (status `confirmed`/`reconciled`/`paid`/`received`)
 *   ocorridas entre o início e hoje.
 * - A partir daí, percorre dia a dia somando movimentações.
 * - Para cada ponto, retorna `realizedBalance` (até hoje) e `projectedBalance`
 *   (a partir de hoje), garantindo continuidade visual entre as duas linhas.
 */
export function buildDailySeries(rows: ConsolidatedRow[], currentBalance: number) {
  const REALIZED_STATUSES = new Set([
    "confirmed",
    "reconciled",
    "paid",
    "received",
    "settled",
  ]);

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  type Bucket = { realizedNet: number; projectedNet: number; inflow: number; outflow: number };
  const byDate = new Map<string, Bucket>();

  for (const r of rows) {
    const cur = byDate.get(r.movement_date) ?? { realizedNet: 0, projectedNet: 0, inflow: 0, outflow: 0 };
    const amt = Number(r.amount);
    const isRealized = REALIZED_STATUSES.has(r.status);

    if (r.direction === "inflow") {
      cur.inflow += amt;
      if (isRealized) cur.realizedNet += amt;
      else cur.projectedNet += amt;
    } else {
      cur.outflow += amt;
      if (isRealized) cur.realizedNet -= amt;
      else cur.projectedNet -= amt;
    }
    byDate.set(r.movement_date, cur);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Calcula saldo no início do período: saldo atual - movimentações realizadas
  // que ocorreram entre o início do período e hoje.
  const realizedSinceStart = sorted
    .filter(([d]) => d <= todayISO)
    .reduce((sum, [, v]) => sum + v.realizedNet, 0);
  const startingBalance = currentBalance - realizedSinceStart;

  // Constrói a série dupla
  let realizedAcc = startingBalance;
  let projectedAcc = startingBalance;
  let lastRealized = startingBalance;

  return sorted.map(([date, v]) => {
    const isPast = date <= todayISO;

    if (isPast) {
      realizedAcc += v.realizedNet + v.projectedNet; // antes de hoje, tudo conta no realizado
      lastRealized = realizedAcc;
      projectedAcc = realizedAcc;
      return {
        date,
        inflow: v.inflow,
        outflow: v.outflow,
        balance: realizedAcc,
        realizedBalance: realizedAcc,
        projectedBalance: null as number | null,
      };
    }

    projectedAcc += v.realizedNet + v.projectedNet;
    return {
      date,
      inflow: v.inflow,
      outflow: v.outflow,
      balance: projectedAcc,
      realizedBalance: null as number | null,
      projectedBalance: projectedAcc,
    };
  });
}
