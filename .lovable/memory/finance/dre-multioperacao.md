---
name: DRE Multioperação por Unidade de Negócio
description: Filtro do DRE por business_unit_id, suportado em todos os lançamentos financeiros
type: feature
---

DRE Mensal (DREMensalView) tem selector "Unidade de Negócio" no topo. Filtra `accounts_payable`, `accounts_receivable`, `cash_transactions`, `manual_bank_transactions`, `pluggy_transactions` por `business_unit_id` (todas as tabelas têm a coluna).

Campo "Unidade de Negócio" (opcional) presente em: Contas a Pagar (form + edição inline), Contas a Receber (form + edição inline), Extrato Manual (ManualBankTransactionDialog), Pluggy (PluggyTransactionEditDialog).

"Sem unidade" = consolidado/empresa toda. Auto-herdar do cliente/fornecedor e Regras Automáticas ficaram para entrega futura.
