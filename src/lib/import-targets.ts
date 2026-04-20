import { supabase } from "@/integrations/supabase/client";
import type { ImportPreview, CashflowSource, ParsedRow } from "./cashflow-helpers";

export type ImportTarget = "cashflow" | "payable" | "receivable" | "bank_statement";

export const TARGET_LABELS: Record<ImportTarget, string> = {
  cashflow: "Fluxo de Caixa",
  payable: "Contas a Pagar",
  receivable: "Contas a Receber",
  bank_statement: "Extrato Bancário",
};

interface CommitParams {
  userId: string;
  empresaId?: string;
  filename: string;
  source: CashflowSource;
  sourceUrl?: string;
  preview: ImportPreview;
  includeDuplicates?: boolean;
  target: ImportTarget;
  bankAccountId?: string;
}

async function createImportRecord(params: CommitParams) {
  const { userId, empresaId, filename, source, sourceUrl, preview, target } = params;
  const { data: imp, error } = await supabase
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
      target,
    } as any)
    .select()
    .single();
  if (error || !imp) throw error ?? new Error("Falha ao registrar importação");
  return imp;
}

async function updateImportCount(importId: string, count: number) {
  await supabase.from("cashflow_imports").update({ inserted_count: count }).eq("id", importId);
}

function rowsToInsert(preview: ImportPreview, includeDuplicates?: boolean): ParsedRow[] {
  return [...preview.valid, ...(includeDuplicates ? preview.duplicates : [])];
}

export async function commitImportTargeted(
  params: CommitParams,
): Promise<{ importId: string; insertedCount: number }> {
  const imp = await createImportRecord(params);
  const rows = rowsToInsert(params.preview, params.includeDuplicates);

  if (rows.length === 0) return { importId: imp.id, insertedCount: 0 };

  let insertedCount = 0;

  if (params.target === "cashflow") {
    const records = rows.map((r) => ({
      user_id: params.userId,
      empresa_id: params.empresaId ?? null,
      direction: r.direction,
      forecast_date: r.forecast_date,
      amount: r.amount,
      description: r.description,
      document_number: r.document_number ?? null,
      category: r.category ?? null,
      source: params.source,
      status: "forecast" as const,
      import_id: imp.id,
      notes: r.notes ?? null,
    }));
    const { error, count } = await supabase
      .from("cashflow_forecasts")
      .insert(records as any, { count: "exact" });
    if (error) throw error;
    insertedCount = count ?? records.length;
  } else if (params.target === "payable") {
    const records = rows
      .filter((r) => r.direction === "outflow") // payable = saídas
      .map((r) => ({
        user_id: params.userId,
        empresa_id: params.empresaId ?? null,
        description: r.description,
        amount: r.amount,
        due_date: r.forecast_date,
        document_number: r.document_number ?? null,
        notes: r.notes ?? null,
        status: "pending" as const,
        import_id: imp.id,
      }));
    if (records.length > 0) {
      const { error, count } = await supabase
        .from("accounts_payable")
        .insert(records as any, { count: "exact" });
      if (error) throw error;
      insertedCount = count ?? records.length;
    }
  } else if (params.target === "receivable") {
    const records = rows
      .filter((r) => r.direction === "inflow") // receivable = entradas
      .map((r) => ({
        user_id: params.userId,
        empresa_id: params.empresaId ?? null,
        description: r.description,
        amount: r.amount,
        due_date: r.forecast_date,
        document_number: r.document_number ?? null,
        notes: r.notes ?? null,
        status: "pending",
        import_id: imp.id,
      }));
    if (records.length > 0) {
      const { error, count } = await supabase
        .from("accounts_receivable")
        .insert(records as any, { count: "exact" });
      if (error) throw error;
      insertedCount = count ?? records.length;
    }
  } else if (params.target === "bank_statement") {
    const records = rows.map((r) => ({
      user_id: params.userId,
      empresa_id: params.empresaId ?? null,
      bank_account_id: params.bankAccountId ?? null,
      transaction_date: r.forecast_date,
      amount: r.amount,
      type: r.direction === "inflow" ? "CREDIT" : "DEBIT",
      description: r.description,
      document_number: r.document_number ?? null,
      category: r.category ?? null,
      notes: r.notes ?? null,
      source: params.source,
      import_id: imp.id,
    }));
    const { error, count } = await supabase
      .from("manual_bank_transactions" as any)
      .insert(records as any, { count: "exact" });
    if (error) throw error;
    insertedCount = count ?? records.length;
  }

  await updateImportCount(imp.id, insertedCount);
  return { importId: imp.id, insertedCount };
}

export async function deleteImportCascade(importId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_import_cascade" as any, { p_import_id: importId });
  if (error) throw error;
}
