// Shared types for all interconnected modules

export type PersonType = "pf" | "pj";
export type EntityType = "empresa" | "pessoa";
export type ProductType = "produto" | "servico";
export type FinancialType = "pagar" | "receber";
export type ActivityType = "ligacao" | "email" | "reuniao" | "tarefa";
export type ContractStatus = "ativo" | "encerrado" | "cancelado" | "pendente";
export type FinancialStatus = "pendente" | "pago" | "atrasado" | "cancelado";

export interface Address {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento?: string;
  numero?: string;
}

export interface Client {
  id: string;
  type: PersonType;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  endereco: Address;
  empresaId?: string;
  usuarioResponsavelId?: string;
  observacoes?: string;
  // PJ
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  // PF
  dataNascimento?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  type: EntityType;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  endereco: Address;
  contatoResponsavel?: string;
  categoria: string;
  observacoes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: Address;
  plano?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contract {
  id: string;
  clienteId: string;
  empresaId?: string;
  usuarioResponsavelId?: string;
  produtoServicoId?: string;
  valor: number;
  dataInicio: Date;
  dataTermino?: Date;
  status: ContractStatus;
  descricao?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductService {
  id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  preco: number;
  tipo: ProductType;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Financial {
  id: string;
  tipo: FinancialType;
  clienteId?: string;
  fornecedorId?: string;
  empresaId?: string;
  contratoId?: string;
  produtoServicoId?: string;
  valor: number;
  dataVencimento: Date;
  dataPagamento?: Date;
  status: FinancialStatus;
  descricao?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  nome: string;
  tipo: string;
  arquivoUrl?: string;
  data: Date;
  usuarioResponsavelId?: string;
  clienteId?: string;
  fornecedorId?: string;
  contratoId?: string;
  empresaId?: string;
  createdAt: Date;
}

export interface Activity {
  id: string;
  tipo: ActivityType;
  descricao: string;
  data: Date;
  usuarioResponsavelId?: string;
  clienteId?: string;
  fornecedorId?: string;
  contratoId?: string;
  createdAt: Date;
}

export interface HistoryEntry {
  id: string;
  usuarioId?: string;
  data: Date;
  acao: string;
  registroTipo: string;
  registroId: string;
  descricao: string;
}

// Tab configuration type used across modules
export interface ModuleTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}
