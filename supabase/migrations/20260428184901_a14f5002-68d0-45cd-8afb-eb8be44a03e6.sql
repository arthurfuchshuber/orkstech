-- Adiciona valor 'cartao_credito' ao enum tipo_conta_bancaria
ALTER TYPE tipo_conta_bancaria ADD VALUE IF NOT EXISTS 'cartao_credito';

-- Colunas auxiliares para cartões de crédito manuais
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS dia_fechamento_fatura SMALLINT,
  ADD COLUMN IF NOT EXISTS dia_vencimento_fatura SMALLINT;