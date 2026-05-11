---
name: Distribuição de Lucros
description: Tipo distribuicao_lucros aparece após Lucro Líquido, gera Lucro Retido (não impacta EBITDA); subcategorias 1-1 com Quadro Societário e sincronia bidirecional
type: feature
---

- Tronco "Distribuição de Lucros" criado automaticamente em toda nova empresa via `seed_dre_troncos`.
- Subcategorias = sócios cadastrados em Configurações > Empresa > Quadro Societário (`empresa_socios`).
- Trigger `trg_sync_socio_to_distribuicao` em `empresa_socios` mantém sincronia:
  - INSERT/UPDATE → cria/atualiza subcategoria com `nome_locked=true` e `origem_socio_id` apontando para o sócio.
  - **DELETE → desvincula lançamentos (categoria_financeira_id=NULL em accounts_payable/receivable, pluggy, manual e cash) e exclui a subcategoria** (usa `set_config('app.allow_locked_delete','on')` para burlar a proteção `nome_locked`).
- Subcategorias com `nome_locked` não podem ser renomeadas/excluídas pelo usuário no Plano de Contas — fonte da verdade é o Quadro Societário.
- No DRE, "Distribuição de Lucros" aparece somente após Lucro Líquido; "Lucro Retido" é calculado e não impacta EBITDA.
- Filtro por `business_unit_id` oculta este bloco (só aparece no consolidado).
