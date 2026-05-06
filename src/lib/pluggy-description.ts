/**
 * Beautifies a Pluggy transaction description.
 * Shared across Extrato, Modais e Dashboard.
 */
export interface PluggyTxLike {
  description?: string | null;
  amount?: number;
  type?: string | null;
  payment_data?: {
    payer?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
    receiver?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
    paymentMethod?: string | null;
  } | null;
}

const isGenericCounterparty = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /banco\s|^caixa$|s\.?a\.?$|^sa$/i.test(trimmed) && trimmed.split(/\s+/).length <= 5;
};

const toTitleCaseName = (str: string) =>
  str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDe\b|\bDa\b|\bDo\b|\bDos\b|\bDas\b|\bE\b/g, (m) => m.toLowerCase());

export const enhancePluggyDescription = (tx: PluggyTxLike): string => {
  const raw = (tx.description || "").trim();
  if (!raw) return "Sem descrição";

  const isCredit = tx.type === "CREDIT" || (tx.amount ?? 0) > 0;

  const parts = raw.split("|").map((p) => p.trim());
  let typeLabel = parts[0] || "";
  let counterparty = parts.slice(1).join(" | ").trim();

  typeLabel = typeLabel
    .replace(/\b(Recebida|Recebido|Enviada|Enviado)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const pd = tx.payment_data;
  if (counterparty && isGenericCounterparty(counterparty) && pd) {
    const realName = isCredit ? pd.payer?.name : pd.receiver?.name;
    if (realName && !isGenericCounterparty(realName)) {
      counterparty = toTitleCaseName(realName);
    } else {
      const doc = isCredit ? pd.payer?.documentNumber?.value : pd.receiver?.documentNumber?.value;
      if (doc) counterparty = `${counterparty} · ${doc}`;
    }
  } else if (counterparty) {
    if (counterparty === counterparty.toUpperCase()) {
      counterparty = toTitleCaseName(counterparty);
    }
  }

  return counterparty ? `${typeLabel} | ${counterparty}` : typeLabel || raw;
};
