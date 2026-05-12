-- 1. Permite excluir subcategorias travadas quando o sócio de origem foi removido (órfãs)
CREATE OR REPLACE FUNCTION public.protect_dre_troncos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_tronco_sistema = true THEN
      RAISE EXCEPTION 'Categoria-tronco do DRE não pode ser excluída';
    END IF;
    -- Bloqueia somente se ainda houver vínculo ativo com sócio
    IF OLD.nome_locked = true
       AND OLD.origem_socio_id IS NOT NULL
       AND COALESCE(current_setting('app.allow_locked_delete', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'Esta subcategoria é gerenciada pelo Quadro Societário';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_tronco_sistema = true THEN
      IF NEW.nome IS DISTINCT FROM OLD.nome
         OR NEW.tipo IS DISTINCT FROM OLD.tipo
         OR NEW.tronco_slug IS DISTINCT FROM OLD.tronco_slug
         OR NEW.categoria_pai_id IS DISTINCT FROM OLD.categoria_pai_id
         OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
        RAISE EXCEPTION 'Categoria-tronco do DRE não pode ser editada';
      END IF;
    END IF;
    IF OLD.nome_locked = true
       AND OLD.origem_socio_id IS NOT NULL
       AND NEW.nome IS DISTINCT FROM OLD.nome
       AND COALESCE(current_setting('app.allow_locked_delete', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'Nome desta categoria é gerenciado pelo Quadro Societário';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.categoria_pai_id IS NULL AND COALESCE(NEW.is_tronco_sistema, false) = false THEN
      RAISE EXCEPTION 'Não é permitido criar categorias raiz. Use os troncos do DRE.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Auto-limpeza de FKs ao excluir uma categoria_financeira (qualquer tipo)
CREATE OR REPLACE FUNCTION public.cleanup_categoria_fks_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE accounts_payable        SET categoria_financeira_id = NULL WHERE categoria_financeira_id = OLD.id;
  UPDATE accounts_receivable     SET categoria_financeira_id = NULL WHERE categoria_financeira_id = OLD.id;
  UPDATE pluggy_transactions     SET categoria_financeira_id = NULL WHERE categoria_financeira_id = OLD.id;
  UPDATE manual_bank_transactions SET categoria_financeira_id = NULL WHERE categoria_financeira_id = OLD.id;
  UPDATE cash_transactions       SET categoria_financeira_id = NULL WHERE categoria_financeira_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_categoria_fks_on_delete ON public.categorias_financeiras;
CREATE TRIGGER trg_cleanup_categoria_fks_on_delete
BEFORE DELETE ON public.categorias_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_categoria_fks_on_delete();