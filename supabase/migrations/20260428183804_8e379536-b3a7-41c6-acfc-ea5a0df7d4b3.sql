CREATE OR REPLACE FUNCTION public.sync_pluggy_to_contas_bancarias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta_id uuid;
  v_invest numeric;
  v_empresa_id uuid;
BEGIN
  v_invest := COALESCE((NEW.bank_data->>'totalInvestments')::numeric, 0);

  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE user_id = NEW.user_id
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_conta_id
  FROM public.contas_bancarias
  WHERE pluggy_account_id = NEW.pluggy_account_id
  LIMIT 1;

  IF v_conta_id IS NULL THEN
    INSERT INTO public.contas_bancarias (
      user_id, empresa_id, nome, banco, tipo, ativo, origem,
      pluggy_account_id,
      saldo_sincronizado,
      investimento_sincronizado,
      fatura_aberto_sincronizada,
      limite_credito_disponivel_sincronizado,
      limite_credito_total_sincronizado,
      limite_credito_total,
      ultima_sync_at
    ) VALUES (
      NEW.user_id,
      v_empresa_id,
      COALESCE(NEW.name, 'Conta'),
      COALESCE(NEW.bank_data->>'marketingName', NULL),
      'corrente'::tipo_conta_bancaria,
      true,
      'pluggy'::origem_dado,
      NEW.pluggy_account_id,
      CASE WHEN NEW.type = 'CREDIT' THEN 0 ELSE COALESCE(NEW.balance, 0) END,
      v_invest,
      CASE WHEN NEW.type = 'CREDIT' THEN COALESCE(NEW.balance, 0) ELSE 0 END,
      COALESCE(NEW.credit_available, 0),
      COALESCE(NEW.credit_limit, 0),
      COALESCE(NEW.credit_limit, 0),
      now()
    );
  ELSE
    UPDATE public.contas_bancarias
    SET
      saldo_sincronizado = CASE WHEN NEW.type = 'CREDIT' THEN saldo_sincronizado ELSE COALESCE(NEW.balance, 0) END,
      investimento_sincronizado = v_invest,
      fatura_aberto_sincronizada = CASE WHEN NEW.type = 'CREDIT' THEN COALESCE(NEW.balance, 0) ELSE fatura_aberto_sincronizada END,
      limite_credito_disponivel_sincronizado = COALESCE(NEW.credit_available, limite_credito_disponivel_sincronizado),
      limite_credito_total_sincronizado = COALESCE(NEW.credit_limit, limite_credito_total_sincronizado),
      limite_credito_total = CASE WHEN limite_credito_total = 0 THEN COALESCE(NEW.credit_limit, 0) ELSE limite_credito_total END,
      origem = 'pluggy'::origem_dado,
      ultima_sync_at = now(),
      updated_at = now()
    WHERE id = v_conta_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pluggy_to_contas ON public.pluggy_bank_accounts;
CREATE TRIGGER trg_sync_pluggy_to_contas
AFTER INSERT OR UPDATE ON public.pluggy_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_pluggy_to_contas_bancarias();

CREATE OR REPLACE FUNCTION public.preserve_snapshot_on_pluggy_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contas_bancarias
  SET origem = 'manual'::origem_dado,
      pluggy_account_id = NULL,
      updated_at = now()
  WHERE pluggy_account_id = OLD.pluggy_account_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_snapshot_on_pluggy_delete ON public.pluggy_bank_accounts;
CREATE TRIGGER trg_preserve_snapshot_on_pluggy_delete
BEFORE DELETE ON public.pluggy_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.preserve_snapshot_on_pluggy_delete();

UPDATE public.pluggy_bank_accounts SET updated_at = updated_at;
