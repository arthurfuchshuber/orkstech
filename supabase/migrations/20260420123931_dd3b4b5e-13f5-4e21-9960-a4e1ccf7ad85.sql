-- Função genérica que escolhe a primeira regra ativa que casa com o lançamento
-- e devolve a categoria_destino_id (ou NULL se nenhuma regra casar).
CREATE OR REPLACE FUNCTION public.resolver_categoria_por_regras(
  p_user_id uuid,
  p_empresa_id uuid,
  p_aplicar_em text, -- 'pagar' | 'receber'
  p_description text,
  p_supplier_name text,
  p_amount numeric,
  p_cliente_id uuid,
  p_supplier_id uuid,
  p_payment_method_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_regra RECORD;
BEGIN
  FOR v_regra IN
    SELECT id, categoria_destino_id, condicoes, condicao_logica
    FROM public.dre_regras
    WHERE ativo = true
      AND escopo = 'persistir'
      AND (
        empresa_id = p_empresa_id
        OR (empresa_id IS NULL AND user_id = p_user_id)
      )
      AND aplicar_em IN (p_aplicar_em, 'ambos')
    ORDER BY ordem ASC
  LOOP
    IF public.avaliar_regra_dre(
      v_regra.condicoes, v_regra.condicao_logica,
      p_description, p_supplier_name, p_amount,
      p_cliente_id, p_supplier_id, p_payment_method_id
    ) THEN
      -- Atualiza contadores da regra
      UPDATE public.dre_regras
        SET executado_count = executado_count + 1,
            ultima_execucao = now()
        WHERE id = v_regra.id;
      RETURN v_regra.categoria_destino_id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Trigger: Contas a Pagar
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_payable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat uuid;
BEGIN
  -- Só aplica quando categoria ainda não foi setada (ou em INSERT)
  IF NEW.categoria_financeira_id IS NULL THEN
    v_cat := public.resolver_categoria_por_regras(
      NEW.user_id, NEW.empresa_id, 'pagar',
      NEW.description, NEW.supplier_name, NEW.amount,
      NEW.cliente_id, NEW.supplier_id, NEW.payment_method_id
    );
    IF v_cat IS NOT NULL THEN
      NEW.categoria_financeira_id := v_cat;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_regras_dre_payable ON public.accounts_payable;
CREATE TRIGGER trg_aplicar_regras_dre_payable
  BEFORE INSERT OR UPDATE OF description, supplier_name, amount, supplier_id, cliente_id, payment_method_id
  ON public.accounts_payable
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_regras_dre_payable();

-- Trigger: Contas a Receber
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat uuid;
BEGIN
  IF NEW.categoria_financeira_id IS NULL THEN
    v_cat := public.resolver_categoria_por_regras(
      NEW.user_id, NEW.empresa_id, 'receber',
      NEW.description, NEW.supplier_name, NEW.amount,
      NEW.cliente_id, NULL, NEW.payment_method_id
    );
    IF v_cat IS NOT NULL THEN
      NEW.categoria_financeira_id := v_cat;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_regras_dre_receivable ON public.accounts_receivable;
CREATE TRIGGER trg_aplicar_regras_dre_receivable
  BEFORE INSERT OR UPDATE OF description, supplier_name, amount, cliente_id, payment_method_id
  ON public.accounts_receivable
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_regras_dre_receivable();

-- Trigger: Extrato Bancário (Pluggy)
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_pluggy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat uuid;
  v_aplicar text;
BEGIN
  IF NEW.categoria_financeira_id IS NULL THEN
    -- DEBIT/saída => regras 'pagar'; CREDIT/entrada => regras 'receber'
    IF NEW.type = 'DEBIT' OR NEW.amount < 0 THEN
      v_aplicar := 'pagar';
    ELSE
      v_aplicar := 'receber';
    END IF;

    v_cat := public.resolver_categoria_por_regras(
      NEW.user_id, NULL, v_aplicar,
      NEW.description, NULL, ABS(NEW.amount),
      NULL, NULL, NULL
    );
    IF v_cat IS NOT NULL THEN
      NEW.categoria_financeira_id := v_cat;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_regras_dre_pluggy ON public.pluggy_transactions;
CREATE TRIGGER trg_aplicar_regras_dre_pluggy
  BEFORE INSERT OR UPDATE OF description, amount, type
  ON public.pluggy_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_regras_dre_pluggy();