
-- Permitir exclusão de categoria/subcategoria descategorizando lançamentos vinculados
ALTER TABLE public.cash_transactions
  DROP CONSTRAINT IF EXISTS cash_transactions_categoria_financeira_id_fkey,
  ADD CONSTRAINT cash_transactions_categoria_financeira_id_fkey
    FOREIGN KEY (categoria_financeira_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;

ALTER TABLE public.pluggy_transactions
  DROP CONSTRAINT IF EXISTS pluggy_transactions_categoria_financeira_id_fkey,
  ADD CONSTRAINT pluggy_transactions_categoria_financeira_id_fkey
    FOREIGN KEY (categoria_financeira_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;

ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS accounts_payable_categoria_financeira_id_fkey,
  ADD CONSTRAINT accounts_payable_categoria_financeira_id_fkey
    FOREIGN KEY (categoria_financeira_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;

ALTER TABLE public.accounts_receivable
  DROP CONSTRAINT IF EXISTS accounts_receivable_categoria_financeira_id_fkey,
  ADD CONSTRAINT accounts_receivable_categoria_financeira_id_fkey
    FOREIGN KEY (categoria_financeira_id) REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;

-- Garantir que regras de classificação automática vinculadas sejam removidas (já estava CASCADE, reforço idempotente)
ALTER TABLE public.dre_regras
  DROP CONSTRAINT IF EXISTS dre_regras_categoria_destino_id_fkey,
  ADD CONSTRAINT dre_regras_categoria_destino_id_fkey
    FOREIGN KEY (categoria_destino_id) REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE;
