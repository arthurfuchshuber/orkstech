## Objetivo

Transformar o DRE em **DRE gerencial multioperação**, permitindo análise consolidada (empresa inteira) ou filtrada por **unidade de negócio / produto** (ex.: SaaS Gestão de Imóveis, Consultoria de Restaurantes, Estética Corporal), sem alterar a lógica de categorias contábeis nem criar indicadores como categorias.

---

## 1. Modelo de dados (nova entidade `business_units`)

Criar tabela própria — `produtos` é catálogo comercial e não deve ser misturado com unidade de negócio (operação/centro de resultado).

```text
business_units
  id, empresa_id, user_id, nome, descricao, cor, ordem, ativo,
  created_at, updated_at
```

RLS espelhando o padrão das demais tabelas (membro da empresa + Super Admin).

Adicionar coluna `business_unit_id uuid NULL` (FK ON DELETE SET NULL) em:

- `accounts_payable`
- `accounts_receivable`
- `pluggy_transactions`
- `manual_bank_transactions`
- `cash_transactions`

Nullable porque lançamentos antigos / consolidados ficam sem unidade (entram no consolidado, somem dos filtros). Índice por `(empresa_id, business_unit_id)` em cada tabela.

**Categorias permanecem intocadas.** Indicadores (Receita Líquida, EBITDA, margens, etc.) continuam **calculados em memória**, nunca persistidos como categoria — comportamento atual já está correto.

---

## 2. Cadastro / UX de Unidades de Negócio

Nova seção em **Configurações > Empresa > Unidades de Negócio** (lista + modal padrão com `ManagedSelect`, drag-and-drop de ordem, status ativo/arquivado, registro automático de permissões).

Em todos os formulários financeiros (Contas a Pagar, Contas a Receber, lançamento manual, modal de categorização da Pluggy/Extrato, AI Scanner, Boleto em massa, lançamentos do RH/Folha):

- Novo campo opcional **Unidade de Negócio** (`ManagedSelect` com inline add).
- Posição: logo após Centro de Custo.
- Persiste `business_unit_id`.

---

## 3. DRE — filtro por unidade

No `useDRE.ts`:

- Novo filtro `businessUnitId?: string | "all"`.
- Aplicar `.eq("business_unit_id", id)` em `accounts_payable`, `accounts_receivable`, `pluggy_transactions` quando filtro ativo.
- Quando filtro ativo, **ocultar** os indicadores `distribuicao-lucros` e `lucro-retido` da lista retornada (continuam existindo só no consolidado).
- Cálculos atuais (Receita Líquida → Lucro Bruto → Resultado Operacional → EBITDA → RAI → Lucro Líquido) e margens já estão corretos e permanecem.

No `DREPage.tsx` e `DREMensalView.tsx`:

- Novo seletor "Unidade de Negócio" no topo (Todas / lista). Persistência local.
- Re-render automático via React Query key.

---

## 4. Impacto em páginas existentes — diagnóstico

| Recurso | Está pronto? | Ação |
|---|---|---|
| Contas a Pagar (form, lista, AI Scanner, bulk boleto) | Não | Adicionar campo + coluna opcional + filtro |
| Contas a Receber | Não | Idem |
| Extrato / Conciliação / Modal de Categorização | Não | Adicionar campo no modal de categorização |
| Fluxo de Caixa | Parcial | Aceitar filtro por unidade (opcional, fase 2) |
| Dashboard 360 / Business Dashboard | Parcial | KPIs continuam consolidados; filtro por unidade vira fase 2 |
| DRE Mensal | Sim, após ajuste do `useDRE` | Aplicar mesmo filtro |
| DRE Drill-down (`DRECategoriaMovimentacoesModal`) | Sim | Mostrar coluna unidade na tabela |
| RH / Folha consolidada → Contas a Pagar | Sim | Permitir definir unidade no colaborador (default), propaga para folha |
| Cliente Workspace > Financeiro | Sim | Apenas exibe; sem alteração obrigatória |
| Plano de Contas / Regras DRE | Sim | Não muda — categorias seguem únicas por empresa |
| Cadastros (Clientes/Fornecedores) | Sim | Sem mudança |
| Permissões | Sim | Novo módulo "Unidades de Negócio" registra permissões automaticamente |

Lançamentos legados sem `business_unit_id`:

- Aparecem no **consolidado** normalmente.
- No filtro por unidade ficam de fora; opcionalmente exibimos um aviso "X lançamentos sem unidade no período" com link para classificação em massa (fase 2).

---

## 5. Entregáveis desta iteração

1. Migração: tabela `business_units` + colunas `business_unit_id` nas 5 tabelas financeiras + RLS + índices.
2. Cadastro em Configurações > Empresa.
3. Campo `business_unit_id` nos formulários de Contas a Pagar e Contas a Receber + modal de categorização do Extrato + AI Scanner.
4. Seletor de unidade no DRE (`DREPage`, `DREMensalView`) + filtro no `useDRE` + ocultação de Distribuição/Lucro Retido quando filtrado.
5. Drill-down do DRE exibindo a unidade.
6. Atualização da memória do projeto (nova feature + regras de filtro).

Fora do escopo desta iteração (sugiro fase 2): filtro de unidade no Fluxo de Caixa, Dashboard 360, relatórios por unidade lado-a-lado e classificação em massa de lançamentos legados.

---

## Detalhes técnicos

- `useDRE` atual já calcula indicadores em memória — basta propagar `businessUnitId` ao `fetchUnified` e filtrar `indicators` quando aplicável.
- `dre_regras` (regras de visualização) continuam empresa-wide; não vinculadas a unidade nesta fase.
- `cash_transactions` recebe a coluna mas o filtro do DRE não a usa diretamente (consumo via AP/AR/Pluggy).
- Todos os dropdowns novos seguem padrão `ManagedSelect` (busca + add inline) conforme regra do projeto.
- Após a migração, atualizar tipos TS é automático (Supabase).
