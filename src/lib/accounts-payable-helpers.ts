import { supabase } from "@/integrations/supabase/client";

export type AccountPayableInsert = {
  user_id: string;
  description: string;
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

export async function fetchAccountsPayable() {
  const { data, error } = await supabase
    .from("accounts_payable")
    .select("*")
    .order("due_date", { ascending: true });
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

export async function countAccountsPayable() {
  const { count: total } = await supabase.from("accounts_payable").select("*", { count: "exact", head: true });
  const { count: pending } = await supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: overdue } = await supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "overdue");
  const { count: paid } = await supabase.from("accounts_payable").select("*", { count: "exact", head: true }).eq("status", "paid");
  return { total: total ?? 0, pending: pending ?? 0, overdue: overdue ?? 0, paid: paid ?? 0 };
}

export async function registerPayment(id: string, bankAccountId: string, paymentDate: string, userId: string) {
  // Update the account payable
  const { data: updated, error: updateError } = await supabase
    .from("accounts_payable")
    .update({
      status: "paid" as any,
      payment_date: paymentDate,
      bank_account_id: bankAccountId || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  // Create cash transaction
  const { error: txError } = await supabase.from("cash_transactions").insert({
    user_id: userId,
    type: "expense" as any,
    amount: (updated as any).amount,
    transaction_date: paymentDate,
    description: `Pagamento: ${(updated as any).description}`,
    account_payable_id: id,
    bank_account_id: bankAccountId || null,
  });
  if (txError) throw txError;

  return updated;
}
