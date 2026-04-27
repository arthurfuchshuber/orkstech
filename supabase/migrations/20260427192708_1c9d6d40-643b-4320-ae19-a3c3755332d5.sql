
-- Tabela de Sócios (Quadro Societário) por empresa
CREATE TABLE public.empresa_socios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Dados pessoais
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  email TEXT,
  telefone TEXT,

  -- Função societária
  cargo TEXT,
  percentual_participacao NUMERIC(5,2) DEFAULT 0,
  data_entrada DATE,
  administrador BOOLEAN NOT NULL DEFAULT false,

  -- Endereço
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,

  -- Dados bancários
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  pix_tipo TEXT,
  pix_chave TEXT,

  notas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_empresa_socios_empresa ON public.empresa_socios(empresa_id);
CREATE INDEX idx_empresa_socios_user ON public.empresa_socios(user_id);

ALTER TABLE public.empresa_socios ENABLE ROW LEVEL SECURITY;

-- Super admin acessa tudo; demais acessam por empresa do tenant (consistente com outras tabelas)
CREATE POLICY "Sócios visíveis ao dono e super admin"
ON public.empresa_socios FOR SELECT
USING (
  public.is_super_admin()
  OR auth.uid() = user_id
  OR public.is_empresa_owner(auth.uid(), empresa_id)
);

CREATE POLICY "Inserir sócio da própria empresa"
ON public.empresa_socios FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (auth.uid() = user_id AND public.is_empresa_owner(auth.uid(), empresa_id))
);

CREATE POLICY "Atualizar sócio da própria empresa"
ON public.empresa_socios FOR UPDATE
USING (
  public.is_super_admin()
  OR auth.uid() = user_id
  OR public.is_empresa_owner(auth.uid(), empresa_id)
);

CREATE POLICY "Excluir sócio da própria empresa"
ON public.empresa_socios FOR DELETE
USING (
  public.is_super_admin()
  OR auth.uid() = user_id
  OR public.is_empresa_owner(auth.uid(), empresa_id)
);

-- Trigger title case no nome do sócio
CREATE OR REPLACE FUNCTION public.normalize_socio_nome()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.nome_completo IS NOT NULL THEN
    NEW.nome_completo := public.title_case_ptbr(NEW.nome_completo);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_socio_nome
BEFORE INSERT OR UPDATE ON public.empresa_socios
FOR EACH ROW EXECUTE FUNCTION public.normalize_socio_nome();

CREATE TRIGGER trg_socios_updated_at
BEFORE UPDATE ON public.empresa_socios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo opcional do sócio em Contas a Pagar
ALTER TABLE public.accounts_payable
  ADD COLUMN socio_id UUID REFERENCES public.empresa_socios(id) ON DELETE SET NULL;

CREATE INDEX idx_accounts_payable_socio ON public.accounts_payable(socio_id);
