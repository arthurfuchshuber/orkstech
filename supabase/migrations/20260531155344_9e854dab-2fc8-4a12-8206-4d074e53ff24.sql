-- 1. Adicionar coluna tipo_gasto_destino_id, tornar categoria_destino_id opcional
ALTER TABLE public.dre_regras
  ADD COLUMN IF NOT EXISTS tipo_gasto_destino_id uuid REFERENCES public.tipos_gasto(id) ON DELETE SET NULL;

ALTER TABLE public.dre_regras ALTER COLUMN categoria_destino_id DROP NOT NULL;

-- Pelo menos um destino
ALTER TABLE public.dre_regras DROP CONSTRAINT IF EXISTS dre_regras_destino_required;
ALTER TABLE public.dre_regras ADD CONSTRAINT dre_regras_destino_required
  CHECK (categoria_destino_id IS NOT NULL OR tipo_gasto_destino_id IS NOT NULL);

-- 2. Nova função: retorna ambos destinos da primeira regra que casar
CREATE OR REPLACE FUNCTION public.resolver_destinos_por_regras(
  p_user_id uuid, p_empresa_id uuid, p_aplicar_em text,
  p_description text, p_supplier_name text, p_amount numeric,
  p_cliente_id uuid, p_supplier_id uuid, p_payment_method_id uuid,
  OUT v_categoria_id uuid, OUT v_tipo_gasto_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra RECORD;
  v_found_cat boolean := false;
  v_found_tg  boolean := false;
BEGIN
  FOR v_regra IN
    SELECT id, categoria_destino_id, tipo_gasto_destino_id, condicoes, condicao_logica
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
      -- Primeira regra que casar preenche cada destino ainda vazio
      IF NOT v_found_cat AND v_regra.categoria_destino_id IS NOT NULL THEN
        v_categoria_id := v_regra.categoria_destino_id;
        v_found_cat := true;
      END IF;
      IF NOT v_found_tg AND v_regra.tipo_gasto_destino_id IS NOT NULL THEN
        v_tipo_gasto_id := v_regra.tipo_gasto_destino_id;
        v_found_tg := true;
      END IF;

      UPDATE public.dre_regras
        SET executado_count = executado_count + 1,
            ultima_execucao = now()
        WHERE id = v_regra.id;

      EXIT WHEN v_found_cat AND v_found_tg;
    END IF;
  END LOOP;
END;
$$;

-- 3. Atualizar trigger de Contas a Pagar para aplicar tipo_gasto também
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_payable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.categoria_financeira_id IS NULL OR NEW.tipo_gasto_id IS NULL THEN
    SELECT * INTO r FROM public.resolver_destinos_por_regras(
      NEW.user_id, NEW.empresa_id, 'pagar',
      NEW.description, NEW.supplier_name, NEW.amount,
      NEW.cliente_id, NEW.supplier_id, NEW.payment_method_id
    );
    IF NEW.categoria_financeira_id IS NULL AND r.v_categoria_id IS NOT NULL THEN
      NEW.categoria_financeira_id := r.v_categoria_id;
    END IF;
    IF NEW.tipo_gasto_id IS NULL AND r.v_tipo_gasto_id IS NOT NULL THEN
      NEW.tipo_gasto_id := r.v_tipo_gasto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Atualizar trigger Pluggy (Extrato Bancário)
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_pluggy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_aplicar text;
BEGIN
  IF NEW.categoria_financeira_id IS NULL OR NEW.tipo_gasto_id IS NULL THEN
    IF NEW.type = 'DEBIT' OR NEW.amount < 0 THEN
      v_aplicar := 'pagar';
    ELSE
      v_aplicar := 'receber';
    END IF;

    SELECT * INTO r FROM public.resolver_destinos_por_regras(
      NEW.user_id, NEW.empresa_id, v_aplicar,
      NEW.description, NULL, ABS(NEW.amount),
      NULL, NULL, NULL
    );
    IF NEW.categoria_financeira_id IS NULL AND r.v_categoria_id IS NOT NULL THEN
      NEW.categoria_financeira_id := r.v_categoria_id;
    END IF;
    IF NEW.tipo_gasto_id IS NULL AND r.v_tipo_gasto_id IS NOT NULL THEN
      NEW.tipo_gasto_id := r.v_tipo_gasto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trigger para lançamentos manuais de banco
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_manual_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_aplicar text;
BEGIN
  IF NEW.categoria_financeira_id IS NULL OR NEW.tipo_gasto_id IS NULL THEN
    v_aplicar := CASE WHEN NEW.amount < 0 THEN 'pagar' ELSE 'receber' END;
    SELECT * INTO r FROM public.resolver_destinos_por_regras(
      NEW.user_id, NEW.empresa_id, v_aplicar,
      NEW.description, NULL, ABS(NEW.amount),
      NULL, NULL, NULL
    );
    IF NEW.categoria_financeira_id IS NULL AND r.v_categoria_id IS NOT NULL THEN
      NEW.categoria_financeira_id := r.v_categoria_id;
    END IF;
    IF NEW.tipo_gasto_id IS NULL AND r.v_tipo_gasto_id IS NOT NULL THEN
      NEW.tipo_gasto_id := r.v_tipo_gasto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_regras_dre_manual_bank ON public.manual_bank_transactions;
CREATE TRIGGER trg_aplicar_regras_dre_manual_bank
  BEFORE INSERT OR UPDATE OF description, amount
  ON public.manual_bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_regras_dre_manual_bank();

-- 6. Trigger para cash_transactions
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_cash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_aplicar text;
BEGIN
  IF NEW.categoria_financeira_id IS NULL OR NEW.tipo_gasto_id IS NULL THEN
    v_aplicar := CASE WHEN NEW.amount < 0 THEN 'pagar' ELSE 'receber' END;
    SELECT * INTO r FROM public.resolver_destinos_por_regras(
      NEW.user_id, NEW.empresa_id, v_aplicar,
      NEW.description, NULL, ABS(NEW.amount),
      NULL, NULL, NULL
    );
    IF NEW.categoria_financeira_id IS NULL AND r.v_categoria_id IS NOT NULL THEN
      NEW.categoria_financeira_id := r.v_categoria_id;
    END IF;
    IF NEW.tipo_gasto_id IS NULL AND r.v_tipo_gasto_id IS NOT NULL THEN
      NEW.tipo_gasto_id := r.v_tipo_gasto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_regras_dre_cash ON public.cash_transactions;
CREATE TRIGGER trg_aplicar_regras_dre_cash
  BEFORE INSERT OR UPDATE OF description, amount
  ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_regras_dre_cash();