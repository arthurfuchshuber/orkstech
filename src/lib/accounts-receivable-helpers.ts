import { supabase } from "@/integrations/supabase/client";
import {
  logFinancialCreated,
  logFinancialPaid,
  logFinancialStatus,
  logFinancialDeleted,
} from "./cliente-history";

export type AccountReceivableInsert = {
  user_id: string;
  empresa_id?: string;
  description: string;
  cliente_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  document_number?: string | null;
  amount: number;
  due_date: string;
  category_id?: string | null;
  categoria_financeira_id?: string | null;
  cost_center_id?: string | null;
  bank_account_id?: string | null;
  payment_method_id?: string | null;
  installment_number?: number;
  installment_total?: number;
  is_recurring?: boolean;
  recurrence_interval?: string | null;
  notes?: string | null;
  attachment_url?: string | null;
  pessoa_tipo?: "pj" | "pf";
  grupo_id?: string | null;
};

export async function fetchAccountsReceivable(empresaId?: string) {
  let query = supabase
    .from("accounts_receivable")
    .select("*")
    .order("due_date", { ascending: true });
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;
  if (error) throw error;

  // Auto-mark overdue
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdueIds: string[] = [];

  const result = (data ?? []).map((item: any) => {
    if (item.status === "pending") {
      const due = new Date(item.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < now) {
        overdueIds.push(item.id);
        return { ...item, status: "overdue" };
      }
    }
    return item;
  });

  if (overdueIds.length > 0) {
    supabase
      .from("accounts_receivable")
      .update({ status: "overdue" } as any)
      .in("id", overdueIds)
      .then();
  }

  return result;
}

export async function createAccountReceivable(records: AccountReceivableInsert[]) {
  const { data, error } = await supabase
    .from("accounts_receivable")
    .insert(records as any)
    .select();
  if (error) throw error;

  for (const rec of (data ?? [])) {
    if (rec.cliente_id && (!rec.installment_number || rec.installment_number === 1)) {
      logFinancialCreated({
        clienteId: rec.cliente_id,
        userId: rec.user_id,
        empresaId: rec.empresa_id,
        kind: "receber",
        description: rec.description,
        amount: Number(rec.amount),
        dueDate: rec.due_date,
        installmentTotal: rec.installment_total,
      });
    }
  }
  return data;
}

export async function updateAccountReceivable(id: string, updates: any) {
  const { data: prev } = await supabase
    .from("accounts_receivable")
    .select("status, cliente_id, user_id, empresa_id, description, amount")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("accounts_receivable")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  if (prev && updates.status && updates.status !== prev.status && updates.status !== "paid" && prev.cliente_id) {
    logFinancialStatus({
      clienteId: prev.cliente_id,
      userId: prev.user_id,
      empresaId: prev.empresa_id,
      description: prev.description,
      newStatus: updates.status,
    });
  }
  return data;
}

export async function deleteAccountReceivable(id: string) {
  const { data: prev } = await supabase
    .from("accounts_receivable")
    .select("cliente_id, user_id, empresa_id, description, amount")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("accounts_receivable").delete().eq("id", id);
  if (error) throw error;

  if (prev?.cliente_id) {
    logFinancialDeleted({
      clienteId: prev.cliente_id,
      userId: prev.user_id,
      empresaId: prev.empresa_id,
      kind: "receber",
      description: prev.description,
      amount: Number(prev.amount),
    });
  }
}

export async function countAccountsReceivable(empresaId?: string) {
  const today = new Date().toISOString().split("T")[0];

  let q1 = supabase.from("accounts_receivable").select("*", { count: "exact", head: true }).in("status", ["pending", "overdue"]);
  let q2 = supabase.from("accounts_receivable").select("*", { count: "exact", head: true }).in("status", ["pending"]).gte("due_date", today);
  let q3 = supabase.from("accounts_receivable").select("*", { count: "exact", head: true }).eq("status", "overdue");
  let q4 = supabase.from("accounts_receivable").select("*", { count: "exact", head: true }).eq("status", "pending").lt("due_date", today);
  let q5 = supabase.from("accounts_receivable").select("*", { count: "exact", head: true }).eq("status", "paid");

  if (empresaId) {
    q1 = q1.eq("empresa_id", empresaId);
    q2 = q2.eq("empresa_id", empresaId);
    q3 = q3.eq("empresa_id", empresaId);
    q4 = q4.eq("empresa_id", empresaId);
    q5 = q5.eq("empresa_id", empresaId);
  }

  const { count: openTotal } = await q1;
  const { count: upcoming } = await q2;
  const { count: overdueExplicit } = await q3;
  const { count: pendingOverdue } = await q4;
  const overdue = (overdueExplicit ?? 0) + (pendingOverdue ?? 0);
  const { count: paid } = await q5;
  return { openTotal: openTotal ?? 0, upcoming: upcoming ?? 0, overdue, paid: paid ?? 0 };
}

export async function registerReceipt(
  id: string,
  bankAccountId: string,
  paymentDate: string,
  userId: string,
  empresaId?: string,
  jurosMulta?: number,
) {
  const updatePayload: any = {
    status: "paid",
    payment_date: paymentDate,
    bank_account_id: bankAccountId || null,
  };
  if (jurosMulta !== undefined && jurosMulta > 0) {
    updatePayload.juros_multa = jurosMulta;
  }

  const { data: updated, error: updateError } = await supabase
    .from("accounts_receivable")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  const totalReceived = Number((updated as any).amount) + (jurosMulta || 0);
  const catFinId = (updated as any).categoria_financeira_id;

  const { error: txError } = await supabase.from("cash_transactions").insert({
    user_id: userId,
    empresa_id: empresaId || null,
    type: "income" as any,
    amount: totalReceived,
    transaction_date: paymentDate,
    description: `Recebimento: ${(updated as any).description}${jurosMulta && jurosMulta > 0 ? ` (+ juros/multa)` : ""}`,
    bank_account_id: bankAccountId || null,
    categoria_financeira_id: catFinId || null,
  });
  if (txError) throw txError;

  if ((updated as any).cliente_id) {
    logFinancialPaid({
      clienteId: (updated as any).cliente_id,
      userId,
      empresaId,
      kind: "receber",
      description: (updated as any).description,
      amount: totalReceived,
      paymentDate,
    });
  }

  return updated;
}
