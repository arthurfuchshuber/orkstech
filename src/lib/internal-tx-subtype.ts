// Classifica movimentações internas em subtipos "técnicos" para rastreio.
// NUNCA contam no DRE — servem só para filtros e visualização.

export type InternalSubtype =
  | "transferencia_entre_contas"
  | "pagamento_fatura"
  | "aplicacao_investimento"
  | "resgate_investimento"
  | "interno_outros";

export const INTERNAL_SUBTYPE_LABEL: Record<InternalSubtype, string> = {
  transferencia_entre_contas: "Transferência entre contas",
  pagamento_fatura: "Pagamento de Fatura de Cartão",
  aplicacao_investimento: "Aplicação",
  resgate_investimento: "Resgate",
  interno_outros: "Movimento interno",
};

interface ClassifyInput {
  is_internal_transfer?: boolean | null;
  amount: number;
  category?: string | null;
  description?: string | null;
  pluggy_account_id?: string;
  type?: string;
}

const isCreditCardPaymentDescription = (desc?: string | null) => {
  const d = (desc || "").toLowerCase();
  return (
    d.includes("fatura") ||
    d.includes("pagto cartao") ||
    d.includes("pagto cartão") ||
    d.includes("pagamento cartao") ||
    d.includes("pagamento cartão") ||
    d.includes("pagamento de cartao") ||
    d.includes("pagamento de cartão") ||
    d.includes("credit card payment")
  );
};

const isInvestmentCategory = (cat?: string | null) => {
  const c = (cat || "").toLowerCase();
  return c.includes("investment") || c.includes("mutual fund") || c.includes("aplicac");
};

const isTransferCategory = (cat?: string | null) => {
  const c = (cat || "").toLowerCase();
  return (
    c.includes("same person transfer") ||
    c.includes("transfer") ||
    c.includes("transferência") ||
    c.includes("transferencia")
  );
};

export function classifyInternalSubtype(
  tx: ClassifyInput,
  creditAccountIds?: Set<string>,
): InternalSubtype | null {
  if (!tx.is_internal_transfer && !(creditAccountIds && tx.pluggy_account_id && creditAccountIds.has(tx.pluggy_account_id) && tx.amount < 0)) {
    return null;
  }
  // Pagamento de fatura: linha do lado CARTÃO com amount<0 (entrada na fatura)
  if (creditAccountIds && tx.pluggy_account_id && creditAccountIds.has(tx.pluggy_account_id) && tx.amount < 0) {
    return "pagamento_fatura";
  }
  // Aplicação/Resgate por categoria Pluggy
  if (isInvestmentCategory(tx.category)) {
    const isIn = tx.type === "CREDIT" || tx.amount > 0;
    return isIn ? "resgate_investimento" : "aplicacao_investimento";
  }
  // Pagamento da fatura visto pelo lado do banco (descrição/categoria)
  const c = (tx.category || "").toLowerCase();
  if (
    c.includes("credit card payment") ||
    c.includes("fatura") ||
    isCreditCardPaymentDescription(tx.description)
  ) {
    return "pagamento_fatura";
  }
  // Transferências entre contas próprias
  if (isTransferCategory(tx.category)) {
    return "transferencia_entre_contas";
  }
  // Default genérico
  return "transferencia_entre_contas";
}
