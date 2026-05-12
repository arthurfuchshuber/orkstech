---
name: Categoria Tree Select
description: Componente único de seleção de subcategoria DRE — árvore expansível + busca + filtro entrada/saída + somente folhas
type: design
---

Use `CategoriaTreeSelect` (`src/components/inputs/CategoriaTreeSelect.tsx`) em todo lugar que seleciona subcategoria do plano de contas (DRE).

Padrão único — proibido criar Select/DropdownMenu paralelos para esse fim.

Características obrigatórias:
- **Árvore expansível** com chevron (▶/▼) para abrir/fechar grupos. Apenas FOLHAS (último nível) são selecionáveis. Nós com filhos servem só pra navegar.
- **Busca digitável** sempre visível no topo do popover. Ao digitar, vira lista plana de folhas com o caminho ancestral em texto secundário.
- **Filtro por direção**: prop `direction="in" | "out" | "both"`.
  - `in`: receita, resultado_financeiro, receita_financeira, ajuste
  - `out`: despesa, despesa_comercial, custo, deducao, imposto, resultado_financeiro, despesa_financeira, distribuicao_lucros, ajuste
- **Trigger minimalista**: texto + chevron no hover (sem borda) — encaixa em qualquer linha de tabela.
- **Limpar categoria** disponível por padrão (`clearable`).
- **Footer actions** opcional pra botões "Nova subcategoria" / "Editar lançamento".

Aplicado em: ExtratoBancario (linhas Pluggy), UncategorizedTransactionsModal, DRECategoriaMovimentacoesModal (drill-down DRE). Próximas integrações devem reutilizar este componente.

## Exclusão de categorias órfãs

Subcategorias `distribuicao_lucros` com `nome_locked=true` mas `origem_socio_id IS NULL` (órfãs de sócios já removidos) podem ser excluídas normalmente. A trigger `protect_dre_troncos` libera quando não há vínculo ativo. Trigger `cleanup_categoria_fks_on_delete` desvincula automaticamente lançamentos (NULL em accounts_payable, accounts_receivable, pluggy_transactions, manual_bank_transactions, cash_transactions) ao deletar qualquer categoria_financeira.
