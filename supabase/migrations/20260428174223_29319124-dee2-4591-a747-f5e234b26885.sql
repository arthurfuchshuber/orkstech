-- ENUM de origem
DO $$ BEGIN
  CREATE TYPE public.origem_dado AS ENUM ('manual', 'pluggy', 'asaas', 'clicksign', 'import', 'hibrido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONTAS BANCÁRIAS
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS saldo_sincronizado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investimento_sincronizado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investimento_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_cheque_especial numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_cheque_especial_sincronizado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatura_aberto_sincronizada numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatura_aberto_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pluggy_account_id text,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text,
  ADD COLUMN IF NOT EXISTS ajuste_atualizado_em timestamptz;

CREATE OR REPLACE VIEW public.contas_bancarias_efetivas AS
SELECT
  cb.*,
  (cb.saldo_inicial + cb.saldo_sincronizado + cb.saldo_ajuste_manual) AS saldo_efetivo,
  (cb.investimento_sincronizado + cb.investimento_ajuste_manual + cb.saldo_investimento) AS investimento_efetivo,
  (cb.fatura_aberto_sincronizada + cb.fatura_aberto_ajuste_manual) AS fatura_efetiva
FROM public.contas_bancarias cb;

-- PLUGGY_INVESTMENTS
ALTER TABLE public.pluggy_investments
  ADD COLUMN IF NOT EXISTS ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text,
  ADD COLUMN IF NOT EXISTS ajuste_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'pluggy',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz DEFAULT now();

-- PLUGGY_BANK_ACCOUNTS
ALTER TABLE public.pluggy_bank_accounts
  ADD COLUMN IF NOT EXISTS balance_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_bill_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit_ajuste_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text,
  ADD COLUMN IF NOT EXISTS ajuste_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'pluggy',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz DEFAULT now();

-- PLUGGY_TRANSACTIONS
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS ajustada_manualmente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_original numeric,
  ADD COLUMN IF NOT EXISTS description_original text,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text,
  ADD COLUMN IF NOT EXISTS ajuste_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'pluggy';

-- ASAAS_COBRANCAS
ALTER TABLE public.asaas_cobrancas
  ADD COLUMN IF NOT EXISTS ajustada_manualmente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS value_original numeric,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text,
  ADD COLUMN IF NOT EXISTS ajuste_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz DEFAULT now();

-- ACCOUNTS_PAYABLE / RECEIVABLE
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS ajustada_manualmente boolean NOT NULL DEFAULT false;

ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS origem public.origem_dado NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ultima_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS ajustada_manualmente boolean NOT NULL DEFAULT false;

-- HISTÓRICO de ajustes
CREATE TABLE IF NOT EXISTS public.ajustes_manuais_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  entidade_tipo text NOT NULL,
  entidade_id uuid NOT NULL,
  campo text NOT NULL,
  valor_anterior numeric,
  valor_novo numeric,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ajustes_manuais_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ajustes log" ON public.ajustes_manuais_log;
CREATE POLICY "Users view own ajustes log" ON public.ajustes_manuais_log
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "Users insert own ajustes log" ON public.ajustes_manuais_log;
CREATE POLICY "Users insert own ajustes log" ON public.ajustes_manuais_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ajustes_log_entidade
  ON public.ajustes_manuais_log (entidade_tipo, entidade_id);

-- RPC para aplicar ajuste de saldo
CREATE OR REPLACE FUNCTION public.aplicar_ajuste_conta_bancaria(
  p_conta_id uuid,
  p_campo text,
  p_novo_valor numeric,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_conta RECORD;
  v_valor_antigo numeric;
  v_delta numeric;
BEGIN
  SELECT * INTO v_conta FROM public.contas_bancarias WHERE id = p_conta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF v_conta.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_campo = 'saldo' THEN
    v_valor_antigo := v_conta.saldo_inicial + v_conta.saldo_sincronizado + v_conta.saldo_ajuste_manual;
    v_delta := p_novo_valor - (v_conta.saldo_inicial + v_conta.saldo_sincronizado);
    UPDATE public.contas_bancarias
      SET saldo_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;
  ELSIF p_campo = 'investimento' THEN
    v_valor_antigo := v_conta.investimento_sincronizado + v_conta.investimento_ajuste_manual + v_conta.saldo_investimento;
    v_delta := p_novo_valor - (v_conta.investimento_sincronizado + v_conta.saldo_investimento);
    UPDATE public.contas_bancarias
      SET investimento_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;
  ELSIF p_campo = 'fatura' THEN
    v_valor_antigo := v_conta.fatura_aberto_sincronizada + v_conta.fatura_aberto_ajuste_manual;
    v_delta := p_novo_valor - v_conta.fatura_aberto_sincronizada;
    UPDATE public.contas_bancarias
      SET fatura_aberto_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;
  ELSIF p_campo = 'limite_cheque_especial' THEN
    v_valor_antigo := v_conta.limite_cheque_especial;
    UPDATE public.contas_bancarias
      SET limite_cheque_especial = p_novo_valor, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;
  ELSE
    RAISE EXCEPTION 'Campo inválido: %', p_campo;
  END IF;

  INSERT INTO public.ajustes_manuais_log (
    user_id, empresa_id, entidade_tipo, entidade_id, campo, valor_anterior, valor_novo, motivo
  ) VALUES (
    auth.uid(), v_conta.empresa_id, 'conta_bancaria', p_conta_id, p_campo, v_valor_antigo, p_novo_valor, p_motivo
  );

  RETURN jsonb_build_object('ok', true, 'campo', p_campo, 'valor_novo', p_novo_valor);
END;
$$;