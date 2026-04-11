import { supabase } from "@/integrations/supabase/client";

// ========== CLIENTES ==========

export async function fetchClientes() {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function checkClienteDuplicidade(tipo: "pf" | "pj", documento: string) {
  const column = tipo === "pf" ? "cpf" : "cnpj";
  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq(column, documento)
    .maybeSingle();
  return !!data;
}

export async function createCliente(cliente: {
  user_id: string;
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

export async function countClientes() {
  const { count: total } = await supabase.from("clientes").select("*", { count: "exact", head: true });
  const { count: pj } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("tipo", "pj");
  const { count: pf } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("tipo", "pf");
  return { total: total ?? 0, pj: pj ?? 0, pf: pf ?? 0 };
}

// ========== FORNECEDORES ==========

export async function fetchFornecedores() {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function checkFornecedorDuplicidade(tipo: "pf" | "pj", documento: string) {
  const column = tipo === "pf" ? "cpf" : "cnpj";
  const { data } = await supabase
    .from("fornecedores")
    .select("id")
    .eq(column, documento)
    .maybeSingle();
  return !!data;
}

export async function createFornecedor(fornecedor: {
  user_id: string;
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

export async function countFornecedores() {
  const { count: total } = await supabase.from("fornecedores").select("*", { count: "exact", head: true });
  const { count: empresas } = await supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("tipo", "pj");
  return { total: total ?? 0, empresas: empresas ?? 0 };
}
