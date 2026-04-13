
-- Add empresa_id to all data tables
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.contas_bancarias ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.categorias_financeiras ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.centros_custo ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.formas_pagamento ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.bancos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.tipos_forma_pagamento ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.automacoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.automacao_gatilhos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.automacao_acoes_tipo ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.notificacoes_sistema ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.historico_sistema ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.cliente_interacoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.cliente_interacao_tipos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.cliente_documentos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Backfill empresa_id from existing data (user's first empresa)
UPDATE public.clientes SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = clientes.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.fornecedores SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = fornecedores.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.accounts_payable SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = accounts_payable.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.contas_bancarias SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = contas_bancarias.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.categorias_financeiras SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = categorias_financeiras.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.centros_custo SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = centros_custo.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.formas_pagamento SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = formas_pagamento.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.bancos SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = bancos.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.tipos_forma_pagamento SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = tipos_forma_pagamento.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.automacoes SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = automacoes.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.automacao_gatilhos SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = automacao_gatilhos.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.automacao_acoes_tipo SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = automacao_acoes_tipo.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.menus SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = menus.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.colaboradores SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = colaboradores.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.produtos SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = produtos.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.cash_transactions SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = cash_transactions.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.notificacoes_sistema SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = notificacoes_sistema.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.historico_sistema SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = historico_sistema.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.cliente_interacoes SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = cliente_interacoes.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.cliente_interacao_tipos SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = cliente_interacao_tipos.user_id LIMIT 1) WHERE empresa_id IS NULL;
UPDATE public.cliente_documentos SET empresa_id = (SELECT id FROM public.empresas WHERE empresas.user_id = cliente_documentos.user_id LIMIT 1) WHERE empresa_id IS NULL;
