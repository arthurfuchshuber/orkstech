# Refatoração UX — Início + Financeiro

Refazer a **camada visual** das duas telas seguindo o estilo dos mockups (Linear/Vercel dark, seções verticais com bordas finas `#1a1d27`, cards `#131720` border-radius 14px, números grandes `weight 500`, paletas semânticas success/warn/destructive). **Mantemos todos os dados, hooks e funcionalidades existentes** — só trocamos a apresentação.

---

## Página Início (`/app` → `DashboardPrincipal.tsx`)

Combinando Inicio1 + Inicio2 numa única tela contínua (mobile = stack vertical, desktop = grid 2 colunas a partir de `lg`).

### Seções (na ordem)

1. **Greeting hero** — "Boa noite, Arthur" + data por extenso (já existe; refinar tipografia).
2. **Visão geral** — grid 2×2 de KPIs operacionais (clientes ativos, contratos ativos, fornecedores, contas a pagar). Estilo `.mcard` do mockup: ícone topo, número 22px, label muted. Já temos os dados em `kpis`.
3. **Requer atenção** — lista de alertas com 3 estados (`danger`, `warn`, `ok`). Puxar de: contas a pagar vencidas (danger), contratos vencendo em ≤15 dias (warn), pendências de categorização (warn). Se vazio, mostra linha "Tudo em dia".
4. **Saúde da empresa** — score 0-100 calculado de 4 indicadores (clientes ativos, contratos OK, % categorizado, contas em dia) com barras horizontais coloridas. Card único.
5. **Clientes recentes** — top 3 clientes (avatar com iniciais, nome, sub status, badge). Link "Ver todos" → `/app/clientes`.
6. **Atividade recente** — timeline vertical (dot + linha) das últimas 5 `notificacoes_sistema`. Já temos os dados em `notifs`.
7. **Acesso rápido** — grid 2×2/4 de atalhos para módulos permitidos (já existe `shortcuts`). Re-estilizar como `.ac-btn`.

### Responsivo

- Mobile (default): 1 coluna, padding lateral 16px, seções separadas por `border-b border-border/40`.
- `md`: KPIs viram 4 colunas.
- `lg`: layout 2 colunas — esquerda (KPIs + Alertas + Saúde), direita (Clientes + Atividade + Acesso rápido).

---

## Página Financeiro (`/app/financas` → `FinanceiroDashboard.tsx`)

Combinando Financeiro1 (hero + métricas) + Financeiro2 (gráficos). **Preserva toda lógica de Pluggy, vínculos, transferências, banners e cards de KPI existentes**, só reorganiza a apresentação.

### Nova estrutura

1. **Banners de sistema** (mantém como está): `IntegrationFailureBanner`, `UncategorizedBanner`, `PendenciasIndicator`, banner de órfãos.

2. **Hero — Patrimônio líquido** (novo, estilo Financeiro1)
   - Label "Patrimônio líquido" + valor R$ grande (36px) = `totalBankBalance + totalInvestments - totalCreditBills - totalOverdraftUsed`.
   - Badge variação 90 dias com seta (calculada do `txHistory`).
   - Sparkline SVG abaixo (90 dias de evolução de saldo).

3. **Métricas resumo 2×2** (estilo `.metrics` Financeiro1) — manter como visão rápida antes dos cards detalhados:
   - Caixinhas, Saldo em conta, Entradas mês, Saídas mês.

4. **Cards detalhados** (mantém `CaixaKpis` atual com os 3 cards Contas/Cartões/Cheque especial — já está bem desenhado e contém AjusteContaTrigger). Apenas reduz protagonismo (vem depois do hero).

5. **Fluxo mensal** (novo, estilo Financeiro2) — gráfico de barras dual (entradas verde / saídas vermelho) últimos 6 meses + card "Resultado do mês" abaixo. Dados de `txHistory + manualTx`. Substitui parte do `CaixaCharts` atual.

6. **Distribuição por banco** (novo, estilo Financeiro2) — donut + legenda com valor/% por conta. Dados de `bankAccounts + manualAccounts`.

7. **Evolução do patrimônio — 90 dias** (novo) — line chart com grid + labels eixo. Reusa série do sparkline do hero em maior tamanho.

8. **Contas a Pagar** (mantém `CartõesCreditoSection`/seções existentes se houver) — reordenado para o final.

### Responsivo

- Mobile: 1 coluna, hero full-width.
- `md`: métricas 4 colunas.
- `lg`: 2 colunas — esquerda (Hero + Métricas + CaixaKpis), direita (Fluxo mensal + Distribuição banco + Evolução).
- `xl`: 3 colunas para os gráficos.

---

## Implementação técnica

- **Sem mudanças no schema** nem em hooks de dados — só refatoração de componentes de apresentação.
- Tokens semânticos do `index.css` (success, warning, destructive, muted, card, border) — nunca cores hex direto.
- Cores do mockup serão mapeadas: `#34c97a` → `text-success`, `#e24b4a` → `text-destructive`, `#ef9f27` → `text-warning`, `#5aabf7` → `text-primary`, `#131720` → `bg-card`, `#1a1d27` → `border-border/40`.
- Gráficos SVG inline (sparkline, barras, donut, line) ou usando `recharts` já no projeto — escolho SVG inline para os pequenos (sparkline, donut) e `recharts` para o de barras 6 meses (reusando `CaixaCharts`).
- Novos componentes:
  - `src/components/dashboard/HeroPatrimonio.tsx`
  - `src/components/dashboard/FluxoMensalChart.tsx` (refatora o existente)
  - `src/components/dashboard/DistribuicaoBancoDonut.tsx`
  - `src/components/dashboard/EvolucaoPatrimonioChart.tsx`
  - `src/components/dashboard/AlertasRequerAtencao.tsx`
  - `src/components/dashboard/SaudeEmpresaCard.tsx`
  - `src/components/dashboard/ClientesRecentesList.tsx`
  - `src/components/dashboard/AtividadeRecenteTimeline.tsx`
- `DashboardPrincipal.tsx` e `FinanceiroDashboard.tsx` viram orquestradores enxutos.

## Fora do escopo

- Não mexe na sidebar, navbar mobile, ou rotas.
- Não mexe na lógica de Pluggy, sincronização, transferências ou vínculos.
- Não cria novas tabelas, edge functions ou migrations.