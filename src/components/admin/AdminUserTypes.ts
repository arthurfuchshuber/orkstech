export interface EmpresaInfo {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  ativo: boolean;
  nivel: string;
  nivel_permissao_id: string | null;
  empresa: string;
  empresa_id: string | null;
  is_owner: boolean;
  empresas: EmpresaInfo[];
}

export interface NivelPermissao {
  id: string;
  nome: string;
}
