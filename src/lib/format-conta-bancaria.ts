/**
 * Normaliza nomes de bancos/contas para exibição compacta em dropdowns e tabelas.
 * Ex.: "Nu Pagamentos S.A. - Instituição de Pagamento" → "Nubank"
 */
export function shortNomeBanco(raw?: string | null): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();

  if (lower.includes("nu pagamentos") || lower.includes("nubank")) return "Nubank";
  if (lower.includes("btg")) return "BTG";
  if (lower.includes("itau") || lower.includes("itaú")) return "Itaú";
  if (lower.includes("bradesco")) return "Bradesco";
  if (lower.includes("santander")) return "Santander";
  if (lower.includes("inter")) return "Banco Inter";
  if (lower.includes("caixa econ")) return "Caixa";
  if (lower.includes("banco do brasil") || /\bbb\b/.test(lower)) return "Banco do Brasil";
  if (lower.includes("sicoob")) return "Sicoob";
  if (lower.includes("sicredi")) return "Sicredi";
  if (lower.includes("c6")) return "C6 Bank";
  if (lower.includes("pagseguro") || lower.includes("pagbank")) return "PagBank";
  if (lower.includes("mercado pago")) return "Mercado Pago";

  // Corta sufixos societários e separadores comuns
  const cut = s.split(/\s+(?:S\.?A\.?|S\/A|LTDA|ME|EIRELI)\b|[-–·(]/i)[0].trim();
  return cut.length > 28 ? `${cut.slice(0, 28)}…` : cut;
}
