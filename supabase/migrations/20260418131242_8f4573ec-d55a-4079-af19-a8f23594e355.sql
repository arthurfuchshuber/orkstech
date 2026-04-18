
-- ============================================================
-- Triggers para registrar automaticamente eventos financeiros
-- na linha do tempo (cliente_interacoes), independente da origem
-- (UI, webhook Asaas, sync Pluggy, edge functions, etc.)
-- ============================================================

-- Helper: formatar moeda BRL
CREATE OR REPLACE FUNCTION public._fmt_brl(v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'R$ ' || replace(replace(replace(to_char(COALESCE(v,0), 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;

-- =================== ACCOUNTS RECEIVABLE ===================
CREATE OR REPLACE FUNCTION public.log_receivable_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_descricao text;
  v_total int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
    -- Apenas a primeira parcela (ou única) registra "criada"
    IF COALESCE(NEW.installment_number, 1) = 1 THEN
      v_total := COALESCE(NEW.installment_total, 1);
      v_titulo := 'Conta a receber criada';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
        || CASE WHEN v_total > 1 THEN ' em ' || v_total || 'x' ELSE '' END
        || ' (venc. ' || to_char(NEW.due_date, 'DD/MM/YYYY') || ')';
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

    -- Pagamento confirmado
    IF OLD.status <> 'paid' AND NEW.status = 'paid' THEN
      v_titulo := 'Recebimento confirmado';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
        || ' em ' || to_char(COALESCE(NEW.payment_date, CURRENT_DATE), 'DD/MM/YYYY');
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');

    -- Conta vencida
    ELSIF OLD.status <> 'overdue' AND NEW.status = 'overdue' THEN
      v_titulo := 'Status atualizado: Vencido';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount);
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');

    -- Cancelada
    ELSIF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro',
              'Conta a receber cancelada. ' || NEW.description || ' — ' || public._fmt_brl(NEW.amount), 'Sistema');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.cliente_id IS NULL THEN RETURN OLD; END IF;
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (OLD.user_id, OLD.empresa_id, OLD.cliente_id, 'Financeiro',
            'Conta a receber excluída. ' || OLD.description || ' — ' || public._fmt_brl(OLD.amount), 'Sistema');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_receivable_event ON public.accounts_receivable;
CREATE TRIGGER trg_log_receivable_event
AFTER INSERT OR UPDATE OR DELETE ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.log_receivable_event();

-- =================== ACCOUNTS PAYABLE ===================
CREATE OR REPLACE FUNCTION public.log_payable_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_descricao text;
  v_total int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
    IF COALESCE(NEW.installment_number, 1) = 1 THEN
      v_total := COALESCE(NEW.installment_total, 1);
      v_titulo := 'Conta a pagar criada';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
        || CASE WHEN v_total > 1 THEN ' em ' || v_total || 'x' ELSE '' END
        || ' (venc. ' || to_char(NEW.due_date, 'DD/MM/YYYY') || ')';
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

    IF OLD.status <> 'paid' AND NEW.status = 'paid' THEN
      v_titulo := 'Pagamento realizado';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
        || ' em ' || to_char(COALESCE(NEW.payment_date, CURRENT_DATE), 'DD/MM/YYYY');
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');

    ELSIF OLD.status <> 'overdue' AND NEW.status = 'overdue' THEN
      v_titulo := 'Status atualizado: Vencido';
      v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount);
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');

    ELSIF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
      INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
      VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro',
              'Conta a pagar cancelada. ' || NEW.description || ' — ' || public._fmt_brl(NEW.amount), 'Sistema');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.cliente_id IS NULL THEN RETURN OLD; END IF;
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (OLD.user_id, OLD.empresa_id, OLD.cliente_id, 'Financeiro',
            'Conta a pagar excluída. ' || OLD.description || ' — ' || public._fmt_brl(OLD.amount), 'Sistema');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_payable_event ON public.accounts_payable;
CREATE TRIGGER trg_log_payable_event
AFTER INSERT OR UPDATE OR DELETE ON public.accounts_payable
FOR EACH ROW EXECUTE FUNCTION public.log_payable_event();

-- =================== ASAAS COBRANCAS (sync inicial) ===================
CREATE OR REPLACE FUNCTION public.log_asaas_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cliente_id IS NOT NULL THEN
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (
      NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro',
      'Cobrança Asaas gerada (' || NEW.billing_type || '). Valor: ' || public._fmt_brl(NEW.value)
        || ' — venc. ' || to_char(NEW.due_date, 'DD/MM/YYYY'),
      'Asaas'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_asaas_event ON public.asaas_cobrancas;
CREATE TRIGGER trg_log_asaas_event
AFTER INSERT ON public.asaas_cobrancas
FOR EACH ROW EXECUTE FUNCTION public.log_asaas_event();

-- =================== BACKFILL: Contas existentes ===================
-- Insere eventos de "criação" para todas as contas a receber/pagar já existentes
-- que possuem cliente_id e ainda não têm registro na linha do tempo.

INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome, created_at)
SELECT
  ar.user_id, ar.empresa_id, ar.cliente_id, 'Financeiro',
  'Conta a receber criada. ' || ar.description || ' — ' || public._fmt_brl(ar.amount)
    || CASE WHEN COALESCE(ar.installment_total,1) > 1 THEN ' em ' || ar.installment_total || 'x' ELSE '' END
    || ' (venc. ' || to_char(ar.due_date, 'DD/MM/YYYY') || ')',
  'Sistema',
  ar.created_at
FROM public.accounts_receivable ar
WHERE ar.cliente_id IS NOT NULL
  AND COALESCE(ar.installment_number, 1) = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_interacoes ci
    WHERE ci.cliente_id = ar.cliente_id
      AND ci.tipo = 'Financeiro'
      AND ci.descricao LIKE 'Conta a receber criada%' || ar.description || '%'
  );

-- Eventos de pagamento (paid)
INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome, created_at)
SELECT
  ar.user_id, ar.empresa_id, ar.cliente_id, 'Financeiro',
  'Recebimento confirmado. ' || ar.description || ' — ' || public._fmt_brl(ar.amount)
    || ' em ' || to_char(COALESCE(ar.payment_date, ar.updated_at::date), 'DD/MM/YYYY'),
  'Sistema',
  COALESCE(ar.payment_date::timestamptz, ar.updated_at)
FROM public.accounts_receivable ar
WHERE ar.cliente_id IS NOT NULL
  AND ar.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_interacoes ci
    WHERE ci.cliente_id = ar.cliente_id
      AND ci.tipo = 'Financeiro'
      AND ci.descricao LIKE 'Recebimento confirmado%' || ar.description || '%'
  );

-- Eventos de vencimento (overdue)
INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome, created_at)
SELECT
  ar.user_id, ar.empresa_id, ar.cliente_id, 'Financeiro',
  'Status atualizado: Vencido. ' || ar.description || ' — ' || public._fmt_brl(ar.amount),
  'Sistema',
  ar.updated_at
FROM public.accounts_receivable ar
WHERE ar.cliente_id IS NOT NULL
  AND ar.status = 'overdue'
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_interacoes ci
    WHERE ci.cliente_id = ar.cliente_id
      AND ci.tipo = 'Financeiro'
      AND ci.descricao LIKE 'Status atualizado: Vencido%' || ar.description || '%'
  );

-- Mesmo backfill para Contas a Pagar
INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome, created_at)
SELECT
  ap.user_id, ap.empresa_id, ap.cliente_id, 'Financeiro',
  'Conta a pagar criada. ' || ap.description || ' — ' || public._fmt_brl(ap.amount)
    || CASE WHEN COALESCE(ap.installment_total,1) > 1 THEN ' em ' || ap.installment_total || 'x' ELSE '' END
    || ' (venc. ' || to_char(ap.due_date, 'DD/MM/YYYY') || ')',
  'Sistema',
  ap.created_at
FROM public.accounts_payable ap
WHERE ap.cliente_id IS NOT NULL
  AND COALESCE(ap.installment_number, 1) = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_interacoes ci
    WHERE ci.cliente_id = ap.cliente_id
      AND ci.tipo = 'Financeiro'
      AND ci.descricao LIKE 'Conta a pagar criada%' || ap.description || '%'
  );

-- Cobranças Asaas existentes
INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome, created_at)
SELECT
  ac.user_id, ac.empresa_id, ac.cliente_id, 'Financeiro',
  'Cobrança Asaas gerada (' || ac.billing_type || '). Valor: ' || public._fmt_brl(ac.value)
    || ' — venc. ' || to_char(ac.due_date, 'DD/MM/YYYY'),
  'Asaas',
  ac.created_at
FROM public.asaas_cobrancas ac
WHERE ac.cliente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cliente_interacoes ci
    WHERE ci.cliente_id = ac.cliente_id
      AND ci.tipo = 'Financeiro'
      AND ci.descricao LIKE 'Cobrança Asaas gerada%' || ac.billing_type || '%'
  );
