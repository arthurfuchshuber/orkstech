import { validateCPF, validateCNPJ } from "@/components/inputs/DocumentInput";

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  const raw = phone.replace(/\D/g, "");
  if (raw.length < 10 || raw.length > 11) return false;
  const ddd = parseInt(raw.slice(0, 2), 10);
  return ddd >= 11 && ddd <= 99;
}

export function validateCep(cep: string): boolean {
  return cep.replace(/\D/g, "").length === 8;
}

export interface FormErrors {
  [key: string]: string;
}

export interface ClientFormData {
  type: "pf" | "pj";
  nomeCompleto: string;
  cpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  telefone: string;
  email: string;
  observacoes: string;
  dataNascimento?: Date;
  endereco: {
    cep: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

export function validateClientForm(form: ClientFormData): FormErrors {
  const errors: FormErrors = {};

  if (form.type === "pf") {
    if (!form.nomeCompleto.trim()) errors.nomeCompleto = "Nome completo é obrigatório";
    const cpfRaw = form.cpf.replace(/\D/g, "");
    if (!cpfRaw) errors.cpf = "CPF é obrigatório";
    else if (!validateCPF(cpfRaw)) errors.cpf = "CPF inválido";
  } else {
    const cnpjRaw = form.cnpj.replace(/\D/g, "");
    if (!cnpjRaw) errors.cnpj = "CNPJ é obrigatório";
    else if (!validateCNPJ(cnpjRaw)) errors.cnpj = "CNPJ inválido";
    if (!form.razaoSocial.trim()) errors.razaoSocial = "Razão social é obrigatória";
  }

  if (!form.telefone) {
    errors.telefone = "Telefone é obrigatório";
  } else if (!validatePhone(form.telefone)) {
    errors.telefone = "Telefone inválido";
  }

  if (!form.email.trim()) {
    errors.email = "Email é obrigatório";
  } else if (!validateEmail(form.email)) {
    errors.email = "Email inválido";
  }

  return errors;
}

export interface SupplierFormData {
  type: "empresa" | "pessoa";
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  contatoResponsavel: string;
  categoria: string;
  observacoes: string;
  endereco: {
    cep: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

export function validateSupplierForm(form: SupplierFormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.nome.trim()) errors.nome = "Nome é obrigatório";

  const docRaw = form.cpfCnpj.replace(/\D/g, "");
  if (form.type === "empresa") {
    if (!docRaw) errors.cpfCnpj = "CNPJ é obrigatório";
    else if (!validateCNPJ(docRaw)) errors.cpfCnpj = "CNPJ inválido";
  } else {
    if (!docRaw) errors.cpfCnpj = "CPF é obrigatório";
    else if (!validateCPF(docRaw)) errors.cpfCnpj = "CPF inválido";
  }

  if (!form.telefone) {
    errors.telefone = "Telefone é obrigatório";
  } else if (!validatePhone(form.telefone)) {
    errors.telefone = "Telefone inválido";
  }

  if (form.email && !validateEmail(form.email)) {
    errors.email = "Email inválido";
  }

  return errors;
}

export { validateCPF, validateCNPJ };
