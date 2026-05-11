-- Sincronia bidirecional: ao deletar sócio, remove a subcategoria de Distribuição de Lucros
-- e desvincula lançamentos (categoria_financeira_id = NULL).
CREATE OR REPLACE FUNCTION public.trg_sync_socio_to_distribuicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_ids uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Coleta categorias geradas a partir do sócio
    SELECT array_agg(id) INTO cat_ids
    FROM categorias_financeiras
    WHERE origem_socio_id = OLD.id;

    IF cat_ids IS NOT NULL AND array_length(cat_ids, 1) > 0 THEN
      -- Desvincula lançamentos
      UPDATE accounts_payable        SET categoria_financeira_id = NULL WHERE categoria_financeira_id = ANY(cat_ids);
      UPDATE accounts_receivable     SET categoria_financeira_id = NULL WHERE categoria_financeira_id = ANY(cat_ids);
      UPDATE pluggy_transactions     SET categoria_financeira_id = NULL WHERE categoria_financeira_id = ANY(cat_ids);
      UPDATE manual_bank_transactions SET categoria_financeira_id = NULL WHERE categoria_financeira_id = ANY(cat_ids);
      UPDATE cash_transactions       SET categoria_financeira_id = NULL WHERE categoria_financeira_id = ANY(cat_ids);

      -- Permite excluir mesmo com nome_locked
      PERFORM set_config('app.allow_locked_delete', 'on', true);
      DELETE FROM categorias_financeiras WHERE id = ANY(cat_ids);
      PERFORM set_config('app.allow_locked_delete', 'off', true);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE: sincroniza criação/atualização das subcategorias
  PERFORM public.sync_socios_to_distribuicao(COALESCE(NEW.empresa_id, OLD.empresa_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;