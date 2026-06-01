---
name: Tipo de Gasto Classificação
description: 12 tipos padrão por empresa, classificação IA retroativa em todas saídas (AP/Pluggy/manual/caixa), regras DRE também aplicam tipo_gasto
type: feature
---
**Defaults:** seed_tipos_gasto_padrao cria 12 tipos no INSERT de empresa (Alimentação, Assinaturas, Consumos, Cuidados Pessoais, Empréstimos, Educação, Lazer, Moradia, Saúde, Seguros, Transporte, Compras). Editáveis em Financeiro > Tipos de Gasto.

**IA:** edge function `classify-tipos-gasto` recebe `{empresa_id, only_uncategorized}`, varre saídas sem tipo_gasto_id em accounts_payable + manual_bank_transactions + cash_transactions por `empresa_id` e pluggy_transactions por `empresas.user_id` (essa tabela não tem empresa_id). Em cartão CREDIT, compras são `amount > 0`; em banco, saídas são `amount < 0`. Usa regras heurísticas BR primeiro e Lovable AI depois, sem sobrescrever campos já preenchidos. Botão "Classificar via IA" no header de Extrato Bancário e Contas a Pagar.

**Regras:** dre_regras agora tem `tipo_gasto_destino_id` (nullable). categoria_destino_id também nullable. CHECK exige pelo menos um. `resolver_destinos_por_regras` retorna ambos. Triggers aplicar_regras_dre_payable/pluggy/manual_bank/cash setam tipo_gasto_id quando regra match e campo está null.
