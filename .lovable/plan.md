## Plano enxuto para 9 correções em ~5 créditos

Agrupei por arquivo/área para minimizar idas e voltas. Tudo é frontend (sem migração).

### Bloco A — Padronizar Subcategoria (CategoriaTreeSelect) em todos os formulários
Substituir o `Select` simples de subcategoria pelo `CategoriaTreeSelect` (mesmo do extrato) e **remover** o campo "Tipo Financeiro (DRE)" (a árvore já filtra por direction in/out).
- `src/components/financas/.../NovaContaPagarModal` (ou equivalente) — item 2
- `src/components/clientes/NovaContaReceberModal.tsx` — itens 4
- Edição inline em Contas a Pagar / Contas a Receber — item 2

### Bloco B — Conta Bancária espelhar 100% o cadastro
Trocar a fonte do dropdown de contas bancárias no **NovaContaReceberModal** (e similar em Contas a Pagar se divergir) para o mesmo hook usado em Configurações > Financeiro > Contas Bancárias (`useBankAccountOptions` com `nome + banco + secundário`, sem abreviar) — itens 3.

### Bloco C — NovaContaReceberModal: outros bugs
- Item 5: capturar o erro real do Supabase e mostrar `toast.error(error.message)` em vez de "Erro ao salvar conta".
- Item 6: ao selecionar pagador, ler `tipo_pessoa` do cliente/fornecedor e fazer `setTipoPessoa(...)` automaticamente.
- Item 7: corrigir overflow do `SelectTrigger` (adicionar `truncate min-w-0` e `max-w-full` no container) para não empurrar o footer.

### Bloco D — Extrato: Centro de Custo + Unidade de Negócio editáveis inline
- Item 1: na tabela do `ExtratoBancario.tsx` e no `UncategorizedTransactionsModal.tsx`, adicionar células editáveis (popover) para **Centro de Custo** e **Unidade de Negócio** — mesmo padrão da Subcategoria inline.

### Bloco E — Tabela responsiva (Contas a Pagar / Contas a Receber)
- Item 8: revisar larguras % das colunas para caber em 1102px sem cortar "Unidade de Negócio". Reduzir colunas menos críticas e garantir `overflow-x-auto` controlado + última coluna sticky de ações.

### Bloco F — Atraso só a partir do dia útil seguinte
- Item 9: no modal "Registrar Pagamento", trocar `isVencida = hoje > vencimento` por verificação que considera 1 dia útil de tolerância: `isVencida = proximoDiaUtil(vencimento) <= hoje` (helper simples pulando sábado/domingo, sem feriados).

### Ordem de execução (para garantir entrega completa mesmo se créditos apertarem)
1. **Bloco A + B + C** (ContaReceberModal) — corrige 5 itens (2, 3, 4, 5, 6, 7) em poucos arquivos. **Prioridade máxima.**
2. **Bloco F** — fix pequeno e isolado (item 9).
3. **Bloco D** — extrato inline (item 1).
4. **Bloco E** — ajuste de larguras (item 8) — mais visual, menor risco.

### Dúvidas antes de executar
Nenhuma. Vou usar `useBankAccountOptions` existente para garantir paridade total e o `CategoriaTreeSelect` que já está no extrato. Se algo divergir do esperado em algum bloco, paro e te aviso antes de gastar crédito a mais.

Confirma para mandar bala nessa ordem?
