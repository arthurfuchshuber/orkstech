import { supabase } from "@/integrations/supabase/client";

export type AccountPayableInsert = {
  user_id: string;
  empresa_id?: string;
  description: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  document_number?: string | null;
  amount: number;
  due_date: string;
  issue_date?: string | null;
  category_id?: string | null;
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
};

export async function fetchAccountsPayable(empresaId?: string) {
  let query = supabase
    .from("accounts_payable")
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

  // Update overdue in background
  if (overdueIds.length > 0) {
    supabase
      .from("accounts_payable")
      .update({ status: "overdue" as any })
      .in("id", overdueIds)
      .then();
  }

  return result;
}

export async function createAccountPayable(records: AccountPayableInsert[]) {
  const { data, error } = await supabase
    .from("accounts_payable")
    .insert(records as any)
    .select();
  if (error) throw error;
  return data;
}

export async function updateAccountPayable(id: string, updates: any) {
  const { data, error } = await supabase
    .from("accounts_payable")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function countAccountsPayable(empresaId?: string) {
  const today = new Date().toISOString().split("T")[0];
  
  let q1 = supabase.from("accounts_payable").select("*", { count: "exact", head: true }).in("status", ["pending", "overdue"]);
  let q2 = supabase.from("accounts_payable").select("*", { count: "exact", head: true }).in("status", ["pending"]).gte("due_date", today);
  let q3 = supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "overdue");
  let q4 = supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "pending").lt("due_date", today);
  let q5 = supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "paid");
  
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

export async function registerPayment(id: string, bankAccountId: string, paymentDate: string, userId: string, empresaId?: string, jurosMulta?: number) {
  const updatePayload: any = {
    status: "paid" as any,
    payment_date: paymentDate,
    bank_account_id: bankAccountId || null,
  };
  if (jurosMulta !== undefined && jurosMulta > 0) {
    updatePayload.juros_multa = jurosMulta;
  }

  const { data: updated, error: updateError } = await supabase
    .from("accounts_payable")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  const totalPaid = Number((updated as any).amount) + (jurosMulta || 0);

  const { error: txError } = await supabase.from("cash_transactions").insert({
    user_id: userId,
    empresa_id: empresaId || null,
    type: "expense" as any,
    amount: totalPaid,
    transaction_date: paymentDate,
    description: `Pagamento: ${(updated as any).description}${jurosMulta && jurosMulta > 0 ? ` (+ juros/multa)` : ""}`,
    account_payable_id: id,
    bank_account_id: bankAccountId || null,
  });
  if (txError) throw txError;

  return updated;
}
