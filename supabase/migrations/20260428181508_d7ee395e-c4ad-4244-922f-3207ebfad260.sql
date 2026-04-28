ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS limite_credito_disponivel_sincronizado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_credito_disponivel_ajuste_manual numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.aplicar_ajuste_conta_bancaria(p_conta_id uuid, p_campo text, p_novo_valor numeric, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ELSIF p_campo = 'limite_credito' THEN
    v_valor_antigo := v_conta.limite_credito_disponivel_sincronizado + v_conta.limite_credito_disponivel_ajuste_manual;
    v_delta := p_novo_valor - v_conta.limite_credito_disponivel_sincronizado;
    UPDATE public.contas_bancarias
      SET limite_credito_disponivel_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
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
$function$;