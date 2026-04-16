
-- Tabela de credenciais de integrações (por empresa)
CREATE TABLE public.integracoes_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('asaas', 'clicksign')),
  api_key TEXT NOT NULL,
  ambiente TEXT NOT NULL DEFAULT 'production' CHECK (ambiente IN ('sandbox', 'production')),
  webhook_token TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_validacao TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, provider)
);

ALTER TABLE public.integracoes_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integracoes_credenciais"
  ON public.integracoes_credenciais FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all integracoes_credenciais"
  ON public.integracoes_credenciais FOR SELECT TO authenticated
  USING (is_super_admin());
CREATE POLICY "Users can create own integracoes_credenciais"
  ON public.integracoes_credenciais FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integracoes_credenciais"
  ON public.integracoes_credenciais FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integracoes_credenciais"
  ON public.integracoes_credenciais FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_integracoes_credenciais_updated_at
  BEFORE UPDATE ON public.integracoes_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de cobranças Asaas
CREATE TABLE public.asaas_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  account_receivable_id UUID,
  cliente_id UUID,
  asaas_customer_id TEXT,
  asaas_payment_id TEXT NOT NULL,
  billing_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  value NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_qr_code TEXT,
  pix_payload TEXT,
  identification_field TEXT,
  payment_date DATE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asaas_payment_id)
);

ALTER TABLE public.asaas_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asaas_cobrancas"
  ON public.asaas_cobrancas FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all asaas_cobrancas"
  ON public.asaas_cobrancas FOR SELECT TO authenticated
  USING (is_super_admin());
CREATE POLICY "Users can create own asaas_cobrancas"
  ON public.asaas_cobrancas FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own asaas_cobrancas"
  ON public.asaas_cobrancas FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own asaas_cobrancas"
  ON public.asaas_cobrancas FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_asaas_cobrancas_updated_at
  BEFORE UPDATE ON public.asaas_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_asaas_cobrancas_receivable ON public.asaas_cobrancas(account_receivable_id);
CREATE INDEX idx_asaas_cobrancas_payment_id ON public.asaas_cobrancas(asaas_payment_id);

-- Tabela de documentos ClickSign
CREATE TABLE public.clicksign_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID,
  clicksign_document_key TEXT NOT NULL,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signatarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  url_original TEXT,
  url_assinado TEXT,
  finalizado_em TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clicksign_document_key)
);

ALTER TABLE public.clicksign_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clicksign_documentos"
  ON public.clicksign_documentos FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all clicksign_documentos"
  ON public.clicksign_documentos FOR SELECT TO authenticated
  USING (is_super_admin());
CREATE POLICY "Users can create own clicksign_documentos"
  ON public.clicksign_documentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clicksign_documentos"
  ON public.clicksign_documentos FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clicksign_documentos"
  ON public.clicksign_documentos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_clicksign_documentos_updated_at
  BEFORE UPDATE ON public.clicksign_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clicksign_documentos_cliente ON public.clicksign_documentos(cliente_id);
