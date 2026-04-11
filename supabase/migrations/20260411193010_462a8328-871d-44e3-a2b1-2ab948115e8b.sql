
-- ============================================
-- FUNÇÃO UTILITÁRIA: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- TIPOS ENUM
-- ============================================
CREATE TYPE public.pessoa_tipo AS ENUM ('pf', 'pj');
CREATE TYPE public.unidade_medida AS ENUM ('un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx', 'pc', 'par', 'kit');

-- ============================================
-- TABELA: EMPRESAS
-- ============================================
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  telefone TEXT,
  email TEXT,
  logradouro TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT empresas_cnpj_unique UNIQUE (cnpj)
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update empresas" ON public.empresas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete empresas" ON public.empresas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA: CLIENTES
-- ============================================
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo pessoa_tipo NOT NULL DEFAULT 'pf',
  nome_completo TEXT,
  cpf TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  telefone TEXT,
  email TEXT,
  data_nascimento DATE,
  logradouro TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clientes_cpf_unique UNIQUE (cpf),
  CONSTRAINT clientes_cnpj_unique UNIQUE (cnpj),
  CONSTRAINT clientes_check_pf CHECK (tipo != 'pf' OR (nome_completo IS NOT NULL AND cpf IS NOT NULL)),
  CONSTRAINT clientes_check_pj CHECK (tipo != 'pj' OR (razao_social IS NOT NULL AND cnpj IS NOT NULL))
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clientes_cpf ON public.clientes(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_clientes_cnpj ON public.clientes(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);

-- ============================================
-- TABELA: FORNECEDORES
-- ============================================
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo pessoa_tipo NOT NULL DEFAULT 'pj',
  nome_completo TEXT,
  cpf TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  telefone TEXT,
  email TEXT,
  logradouro TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_cpf_unique UNIQUE (cpf),
  CONSTRAINT fornecedores_cnpj_unique UNIQUE (cnpj),
  CONSTRAINT fornecedores_check_pf CHECK (tipo != 'pf' OR (nome_completo IS NOT NULL AND cpf IS NOT NULL)),
  CONSTRAINT fornecedores_check_pj CHECK (tipo != 'pj' OR (razao_social IS NOT NULL AND cnpj IS NOT NULL))
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fornecedores_cpf ON public.fornecedores(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_fornecedores_cnpj ON public.fornecedores(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_fornecedores_user_id ON public.fornecedores(user_id);

-- ============================================
-- TABELA: PRODUTOS
-- ============================================
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  sku TEXT,
  unidade unidade_medida NOT NULL DEFAULT 'un',
  preco_custo NUMERIC(12,2) DEFAULT 0,
  preco_venda NUMERIC(12,2) DEFAULT 0,
  estoque_minimo NUMERIC(12,2) DEFAULT 0,
  estoque_atual NUMERIC(12,2) DEFAULT 0,
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produtos_sku_unique UNIQUE (sku)
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create produtos" ON public.produtos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update produtos" ON public.produtos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete produtos" ON public.produtos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_produtos_sku ON public.produtos(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_produtos_user_id ON public.produtos(user_id);

-- ============================================
-- TABELA: COLABORADORES
-- ============================================
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  cargo TEXT,
  departamento TEXT,
  telefone TEXT,
  email TEXT,
  data_admissao DATE,
  salario NUMERIC(12,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT colaboradores_cpf_unique UNIQUE (cpf)
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view colaboradores" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create colaboradores" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update colaboradores" ON public.colaboradores FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete colaboradores" ON public.colaboradores FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_colaboradores_cpf ON public.colaboradores(cpf);
CREATE INDEX idx_colaboradores_user_id ON public.colaboradores(user_id);
