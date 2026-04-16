/**
 * Centralized helper for logging cliente events automatically.
 * Any module action related to a client should call logClienteEvent
 * so it appears in the "Linha do Tempo" (Visão Geral tab) of that client.
 */
import { supabase } from "@/integrations/supabase/client";

type EventTipo = "Financeiro" | "Atualização" | "Documento" | "Contrato" | "Nota" | "Observação";

interface LogEventParams {
  clienteId: string;
  userId: string;
  tipo: EventTipo;
  titulo: string;
  descricao?: string;
  empresaId?: string | null;
  usuarioNome?: string;
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export async function logClienteEvent({
  clienteId,
  userId,
  tipo,
  titulo,
  descricao = "",
  empresaId,
  usuarioNome,
}: LogEventParams) {
  if (!clienteId) return;
  const fullDesc = `${titulo}. ${descricao}`.trim().replace(/\.\s*$/, "");
  try {
    await supabase.from("cliente_interacoes").insert({
      user_id: userId,
      cliente_id: clienteId,
      empresa_id: empresaId || null,
      tipo,
      descricao: fullDesc,
      usuario_nome: usuarioNome || "Sistema",
    });
  } catch (err) {
    // Non-blocking: history must never break the main flow
    console.error("[logClienteEvent] failed:", err);
  }
}

// Convenience helpers for common financial events --------------------------

export async function logFinancialCreated(opts: {
  clienteId: string;
  userId: string;
  empresaId?: string | null;
  kind: "pagar" | "receber";
  description: string;
  amount: number;
  dueDate: string;
  installmentTotal?: number;
}) {
  const label = opts.kind === "receber" ? "Conta a receber criada" : "Conta a pagar criada";
  const installments =
    opts.installmentTotal && opts.installmentTotal > 1
      ? ` em ${opts.installmentTotal}x`
      : "";
  return logClienteEvent({
    clienteId: opts.clienteId,
    userId: opts.userId,
    empresaId: opts.empresaId,
    tipo: "Financeiro",
    titulo: label,
    descricao: `${opts.description} — ${currency(opts.amount)}${installments} (venc. ${formatDate(opts.dueDate)})`,
  });
}

export async function logFinancialPaid(opts: {
  clienteId: string;
  userId: string;
  empresaId?: string | null;
  kind: "pagar" | "receber";
  description: string;
  amount: number;
  paymentDate: string;
}) {
  const label = opts.kind === "receber" ? "Recebimento confirmado" : "Pagamento realizado";
  return logClienteEvent({
    clienteId: opts.clienteId,
    userId: opts.userId,
    empresaId: opts.empresaId,
    tipo: "Financeiro",
    titulo: label,
    descricao: `${opts.description} — ${currency(opts.amount)} em ${formatDate(opts.paymentDate)}`,
  });
}

export async function logFinancialStatus(opts: {
  clienteId: string;
  userId: string;
  empresaId?: string | null;
  description: string;
  newStatus: string;
}) {
  const map: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado",
  };
  return logClienteEvent({
    clienteId: opts.clienteId,
    userId: opts.userId,
    empresaId: opts.empresaId,
    tipo: "Financeiro",
    titulo: `Status atualizado: ${map[opts.newStatus] || opts.newStatus}`,
    descricao: opts.description,
  });
}

export async function logFinancialDeleted(opts: {
  clienteId: string;
  userId: string;
  empresaId?: string | null;
  kind: "pagar" | "receber";
  description: string;
  amount: number;
}) {
  const label = opts.kind === "receber" ? "Conta a receber excluída" : "Conta a pagar excluída";
  return logClienteEvent({
    clienteId: opts.clienteId,
    userId: opts.userId,
    empresaId: opts.empresaId,
    tipo: "Financeiro",
    titulo: label,
    descricao: `${opts.description} — ${currency(opts.amount)}`,
  });
}

export async function logClienteUpdated(opts: {
  clienteId: string;
  userId: string;
  empresaId?: string | null;
  changedFields?: string[];
}) {
  const fields = opts.changedFields && opts.changedFields.length > 0
    ? `Campos atualizados: ${opts.changedFields.join(", ")}`
    : "Dados cadastrais foram atualizados.";
  return logClienteEvent({
    clienteId: opts.clienteId,
    userId: opts.userId,
    empresaId: opts.empresaId,
    tipo: "Atualização",
    titulo: "Cadastro atualizado",
    descricao: fields,
  });
}

function formatDate(iso: string) {
  try {
    const [y, m, d] = iso.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}
