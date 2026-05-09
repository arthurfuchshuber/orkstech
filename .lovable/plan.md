# Reestruturação do DRE — Plano completo

## 1. Banco de dados (1 migração)

**Enum `tipo_categoria`** — adicionar:
- `despesa_comercial`
- `resultado_financeiro` (tronco neutro; subs continuam usando `receita_financeira` ou `despesa_financeira`)

**Tabela `categorias_financeiras`** — novas colunas:
- `is_tronco_sistema boolean default false` → marca os 9 troncos oficiais. Bloqueia edição/exclusão/criação de irmãos no nível raiz.
- `tronco_slug text` → identificador estável: `receita_operacional`, `deducoes_receita`, `custos_diretos`, `despesas_operacionais`, `despesas_comerciais`, `resultado_financeiro`, `impostos`, `distribuicao_lucros`. Único por empresa quando `is_tronco_sistema=true`.

**Trigger `protect_dre_troncos`** — impede:
- DELETE em linhas com `is_tronco_sistema=true`
- UPDATE de `nome`, `tipo`, `categoria_pai_id`, `tronco_slug`, `ativo` em troncos
- INSERT no nível raiz (`categoria_pai_id IS NULL`) por usuário comum (apenas via seed)

**Função `seed_dre_troncos(empresa_id, user_id)`** — cria as 8 categorias-tronco oficiais (sem "Distribuição de Lucros" se já existir; reaproveita a atual). Chamada:
- Migração inicial: seed em todas empresas existentes
- Trigger `on_empresa_insert`: seed automático para novas empresas

**Sócios em Distribuição de Lucros** — função `sync_socios_to_distribuicao(empresa_id)`:
- Para cada sócio em `socios_empresa` (ativos), garante uma categoria filha do tronco `distribuicao_lucros` com `nome = sócio.nome` e `nome_locked=true`.
- Trigger `after insert/update/delete on socios_empresa` chama a função.
- Nova coluna `nome_locked boolean default false` em `categorias_financeiras` para impedir rename dessas subs (mas permitir mover para outra subpasta dentro do mesmo tronco se quiser).

**Migração de dados existentes**:
- Para cada empresa, criar os 8 troncos novos (Distribuição já existe).
- Não auto-mover categorias existentes para troncos. Em vez disso, marcar todas as categorias raiz hoje (exceto `distribuicao_lucros`) como **órfãs**, mostrando um banner em "Plano de Contas": "Mova X categorias para os troncos do DRE para que apareçam nos cálculos". Categorias órfãs continuam funcionando para lançamentos, mas não somam no DRE (já é o comportamento atual quando o tipo não bate).
- Alternativa: oferecer no banner um botão "Sugerir mapeamento" via `tipo` antigo → tronco correspondente (`receita`→Receita Operacional, `despesa`→Despesas Operacionais, `custo`→Custos Diretos, etc.). Usuário confirma um a um.

## 2. Hooks/lógica DRE

**`useDRE.ts` e `useDREMonthly.ts`**:
- Reordenar indicadores conforme nova lista (1–19).
- Nova categoria `despesa_comercial` somando junto com `despesa` para "Resultado Operacional", mas exibida como linha separada **#8 Despesas Comerciais**.
- Tronco `resultado_financeiro` no topo passa a ser **listado** (era oculto antes); mas `distribuicao_lucros` no topo passa a ser **oculto** (só aparece como indicador #18 no final). A regra anterior de ocultar quando filtrado por unidade continua.
- Indicador #18 "Distribuição de Lucros" passa a mostrar **drill-down por sócio** (subs do tronco) — clicável.

## 3. UI — Plano de Contas (`CategoriaCadastroModal` / página)

- Troncos exibidos com badge "DRE" + ícone de cadeado, sem ações de editar/excluir/reordenar.
- Botão "+ Nova categoria" no nível raiz **desabilitado** com tooltip "Os troncos do DRE são fixos. Crie subcategorias dentro deles."
- "+ Nova subcategoria" dentro de cada tronco continua livre.
- Drag-and-drop: subs podem ser arrastadas entre troncos (atualiza `categoria_pai_id` + recalcula `tipo` herdado do tronco). Troncos não arrastáveis.
- Sub-categorias com `nome_locked=true` (sócios) escondem o lápis de renomear; ainda podem ser arrastadas.

## 4. Dropdowns financeiros

`ManagedSelectInput` para categoria nas telas de Contas a Pagar/Receber/Extrato:
- Quando o usuário clica "+ Nova categoria" inline, modal pede **tronco pai obrigatório** (select com os 8 troncos) + nome. Não permite criar no nível raiz.
- Hierarquia visual já existente (nível 0 = tronco com badge, nível 1+ = subs indentadas) é reforçada.

## 5. Edição inline em tabelas

Adicionar célula editável (popover com `ManagedSelectInput`) nas seguintes colunas das listagens:

| Página/Modal | Categoria | Centro Custo | Unidade Negócio |
|---|---|---|---|
| Contas a Pagar (lista) | ✅ | ✅ | ✅ |
| Contas a Receber (lista) | ✅ | ✅ | ✅ |
| Extrato Bancário | ✅ | ✅ | ✅ |
| `DRECategoriaMovimentacoesModal` (drill-down) | ✅ | — | ✅ |
| `UncategorizedTransactionsModal` | ✅ (já tem) | — | — |

Padrão: célula mostra valor atual; clique abre popover compacto com select; salva em `onChange` com toast + `refreshQueries`.

## 6. Permissões

Auto-registrar dois novos itens no modal de Permissões:
- `dre.troncos.gerenciar` (apenas Super Admin) — nunca aparece para usuários, garante que só seed/migrations mexem.
- `cadastros.categorias.mover_subs` — admin/financeiro.

## 7. Checagem cross-SaaS

Páginas/recursos que tocam estrutura DRE e serão atualizados:
- `useDRE`, `useDREMonthly`, `DREMensalView`, `DREPersonalizadoView`, `DRECategoriaMovimentacoesModal`
- `CategoriaCadastroModal`, `CategoriaFinanceiraModal`, página Plano de Contas
- `ManagedSelectInput` quando `tableName="categorias_financeiras"`
- `ContasAPagar`, `ContasAReceber`, `ExtratoBancario` (formulários e tabelas)
- `UncategorizedTransactionsModal`, `BulkBoletoScanner`
- `useManagedSelect` (insert default precisa setar `categoria_pai_id` do tronco escolhido)
- Memória do projeto: atualizar `dre-structure`, `chart-of-accounts-ux`, `distribuicao-lucros`, `dre-reporting-logic`, `classification-ux`

## Detalhes técnicos sensíveis

- O enum `tipo_categoria` em Postgres exige `ALTER TYPE ... ADD VALUE` (não pode rodar dentro de transação BEGIN; Supabase migration aceita).
- Trigger de proteção precisa permitir bypass para `service_role` (uso do seed).
- Recalcular numeração hierárquica do plano de contas após seed para manter `1.`, `2.`, etc.
- `nome_locked` em sócios: se o usuário renomear um sócio em Quadro Societário, o trigger atualiza o nome da categoria correspondente.
- Fora do escopo: mapeamento automático em massa de categorias antigas → troncos. Usuário fará manualmente via drag.

---

**Ao aprovar**, rodo nesta ordem:
1. Migração SQL (enum + colunas + triggers + seed + função sócios)
2. Refactor de `useDRE` / `useDREMonthly` + view
3. Refactor de `CategoriaCadastroModal` e plano de contas
4. Edição inline nas 5 tabelas
5. Atualização de memórias do projeto
