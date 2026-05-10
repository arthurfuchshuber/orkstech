---
name: Inline Table Editing
description: Padrão de células de tabela editáveis via popover com Add/Edit/Delete pelo modal pai
type: design
---

Use `InlineManagedCell` (`src/components/inputs/InlineManagedCell.tsx`) em qualquer célula de tabela que represente FK editável (categoria, centro de custo, unidade de negócio, conta bancária, forma de pagamento, etc.).

Características obrigatórias:
- Trigger é apenas texto + chevron no hover (sem borda) — encaixa visualmente na linha.
- Popover sempre tem campo de busca.
- Cada item do popover expõe ícones de Editar (lápis) e Excluir (lixeira) ao hover.
- Editar SEMPRE chama `onEditModal(id)` que abre o modal original do cadastro daquela entidade (CategoriaFinanceiraModal, CentroCustoModal, BusinessUnitModal, ContaBancariaModal, FormaPagamentoModal etc.).
- Adicionar SEMPRE chama `onAddModal()` que abre o mesmo modal em modo criação. Nunca usar input inline para criar.
- Excluir usa `useManagedSelect(table).onDelete`.
- Após qualquer mutação, refletir mudança via React Query invalidation (já feito pelos hooks CRUD).

Aplicado em: Contas a Pagar (Subcategoria, Centro de Custo, Unidade de Negócio, Forma, Conta), Contas a Receber (mesmas colunas). Próximas tabelas a aplicar: Extrato Bancário, DRECategoriaMovimentacoesModal.
