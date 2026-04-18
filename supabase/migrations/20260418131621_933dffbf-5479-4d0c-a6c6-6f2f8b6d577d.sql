-- 1. Remover trigger Asaas (gerava evento redundante)
DROP TRIGGER IF EXISTS trg_log_asaas_event ON public.asaas_cobrancas;

-- 2. Atualizar trigger de receivable para deduplicar dentro de uma janela de 60s
CREATE OR REPLACE FUNCTION public.log_receivable_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_titulo text;
  v_descricao text;
  v_total int;
  v_recent_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

    -- Dedup: se já houve criação de receivable para este cliente nos últimos 60s, agrupa
    SELECT COUNT(*) INTO v_recent_count
    FROM public.cliente_interacoes
    WHERE cliente_id = NEW.cliente_id
      AND tipo = 'Financeiro'
      AND usuario_nome = 'Sistema'
      AND descricao LIKE 'Conta a receber criada%'
      AND created_at > now() - interval '60 seconds';

    IF v_recent_count > 0 THEN
      -- Atualiza o último evento para refletir o agrupamento
      UPDATE public.cliente_interacoes
      SET descricao = 'Conta(s) a receber criada(s): ' || (v_recent_count + 1) || ' lançamento(s) — '
                      || public._fmt_brl(
                        (SELECT COALESCE(SUM(amount),0) FROM public.accounts_receivable
                         WHERE cliente_id = NEW.cliente_id
                           AND created_at > now() - interval '60 seconds')
                      )
      WHERE id = (
        SELECT id FROM public.cliente_interacoes
        WHERE cliente_id = NEW.cliente_id
          AND tipo = 'Financeiro'
          AND usuario_nome = 'Sistema'
          AND descricao LIKE 'Conta%a receber criada%'
          AND created_at > now() - interval '60 seconds'
        ORDER BY created_at DESC LIMIT 1
      );
      RETURN NEW;
    END IF;

    v_total := COALESCE(NEW.installment_total, 1);
    v_titulo := 'Conta a receber criada';
    v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
      || CASE WHEN v_total > 1 THEN ' em ' || v_total || 'x' ELSE '' END
      || ' (venc. ' || to_char(NEW.due_date, 'DD/MM/YYYY') || ')';
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

    IF OLD.status <> 'paid' AND NEW.status = 'paid' THEN
      v_titulo := 'Recebimento confirmado';
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
$function$;

-- 3. Mesma lógica de agrupamento para payable
CREATE OR REPLACE FUNCTION public.log_payable_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_titulo text;
  v_descricao text;
  v_total int;
  v_recent_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

    SELECT COUNT(*) INTO v_recent_count
    FROM public.cliente_interacoes
    WHERE cliente_id = NEW.cliente_id
      AND tipo = 'Financeiro'
      AND usuario_nome = 'Sistema'
      AND descricao LIKE 'Conta%a pagar criada%'
      AND created_at > now() - interval '60 seconds';

    IF v_recent_count > 0 THEN
      UPDATE public.cliente_interacoes
      SET descricao = 'Conta(s) a pagar criada(s): ' || (v_recent_count + 1) || ' lançamento(s) — '
                      || public._fmt_brl(
                        (SELECT COALESCE(SUM(amount),0) FROM public.accounts_payable
                         WHERE cliente_id = NEW.cliente_id
                           AND created_at > now() - interval '60 seconds')
                      )
      WHERE id = (
        SELECT id FROM public.cliente_interacoes
        WHERE cliente_id = NEW.cliente_id
          AND tipo = 'Financeiro'
          AND usuario_nome = 'Sistema'
          AND descricao LIKE 'Conta%a pagar criada%'
          AND created_at > now() - interval '60 seconds'
        ORDER BY created_at DESC LIMIT 1
      );
      RETURN NEW;
    END IF;

    v_total := COALESCE(NEW.installment_total, 1);
    v_titulo := 'Conta a pagar criada';
    v_descricao := NEW.description || ' — ' || public._fmt_brl(NEW.amount)
      || CASE WHEN v_total > 1 THEN ' em ' || v_total || 'x' ELSE '' END
      || ' (venc. ' || to_char(NEW.due_date, 'DD/MM/YYYY') || ')';
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (NEW.user_id, NEW.empresa_id, NEW.cliente_id, 'Financeiro', v_titulo || '. ' || v_descricao, 'Sistema');
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
$function$;