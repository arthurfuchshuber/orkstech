---
name: DRE Multioperação
description: DRE pode ser consolidado ou filtrado por unidade de negócio (produto/operação); Distribuição de Lucros e Lucro Retido só aparecem no consolidado
type: feature
---
- Tabela `business_units` (empresa-scoped, RLS por membro) representa produtos/operações (ex: SaaS Imóveis, Consultoria, Estética).
- Coluna opcional `business_unit_id` em accounts_payable, accounts_receivable, pluggy_transactions, manual_bank_transactions, cash_transactions (FK ON DELETE SET NULL).
- Cadastro em Configurações > Empresa > Unidades de Negócio (`BusinessUnitsSection`).
- Filtro `businessUnitId` em `useDRE` e `useDREMonthly`. Quando filtrado: oculta indicadores `distribuicao-lucros` e `lucro-retido` + categoria-tronco `distribuicao_lucros`.
- Indicadores (Receita Líquida, Lucro Bruto, EBITDA, margens, etc.) NUNCA são categorias no banco — sempre calculados em memória.
- Lançamentos sem `business_unit_id` aparecem só no consolidado.
- Form de Contas a Pagar tem campo opcional logo após Centro de Custo. Receivables/Pluggy/manual reuse mesmo padrão (a expandir conforme demanda).
