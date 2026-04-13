import { supabase } from "@/integrations/supabase/client";

// ========== CLIENTES ==========

export async function fetchClientes(empresaId?: string) {
  let query = supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function checkClienteDuplicidade(tipo: "pf" | "pj", documento: string, empresaId?: string) {
  const column = tipo === "pf" ? "cpf" : "cnpj";
  let query = supabase.from("clientes").select("id").eq(column, documento);
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function createCliente(cliente: {
  user_id: string;
  empresa_id?: string;
  tipo: "pf" | "pj";
  nome_completo?: string;
  cpf?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
}) {
  const { data, error } = await supabase.from("clientes").insert(cliente).select().single();
  if (error) throw error;
  return data;
}

export async function countClientes(empresaId?: string) {
  let q1 = supabase.from("clientes").select("*", { count: "exact", head: true });
  let q2 = supabase.from("clientes").select("*", { count: "exact", head: true }).eq("tipo", "pj");
  let q3 = supabase.from("clientes").select("*", { count: "exact", head: true }).eq("tipo", "pf");
  if (empresaId) {
    q1 = q1.eq("empresa_id", empresaId);
    q2 = q2.eq("empresa_id", empresaId);
    q3 = q3.eq("empresa_id", empresaId);
  }
  const { count: total } = await q1;
  const { count: pj } = await q2;
  const { count: pf } = await q3;
  return { total: total ?? 0, pj: pj ?? 0, pf: pf ?? 0 };
}

// ========== FORNECEDORES ==========

export async function fetchFornecedores(empresaId?: string) {
  let query = supabase
    .from("fornecedores")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function checkFornecedorDuplicidade(tipo: "pf" | "pj", documento: string, empresaId?: string) {
  const column = tipo === "pf" ? "cpf" : "cnpj";
  let query = supabase.from("fornecedores").select("id").eq(column, documento);
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function createFornecedor(fornecedor: {
  user_id: string;
  empresa_id?: string;
  tipo: "pf" | "pj";
  nome_completo?: string;
  cpf?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
}) {
  const { data, error } = await supabase.from("fornecedores").insert(fornecedor).select().single();
  if (error) throw error;
  return data;
}

export async function countFornecedores(empresaId?: string) {
  let q1 = supabase.from("fornecedores").select("*", { count: "exact", head: true });
  let q2 = supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("tipo", "pj");
  if (empresaId) {
    q1 = q1.eq("empresa_id", empresaId);
    q2 = q2.eq("empresa_id", empresaId);
  }
  const { count: total } = await q1;
  const { count: empresas } = await q2;
  return { total: total ?? 0, empresas: empresas ?? 0 };
}
