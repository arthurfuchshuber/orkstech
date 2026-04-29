---
name: Uncategorized Transactions Alerts
description: Sistema proativo de alertas (banner Extrato + Dashboard 360 + sino) para transações Pluggy sem subcategoria DRE
type: feature
---

Detecção e visibilidade máxima de transações bancárias (Pluggy) sem `categoria_financeira_id`:

- **DB:** `contar_transacoes_sem_categoria(p_user_id)` exclui `is_internal_transfer = true`. `notificar_transacoes_sem_categoria` cria/atualiza notificação no sino, deduplicada por `entidade_tipo='transacoes_sem_categoria'` não-lida.
- **Hook:** `useUncategorizedTransactions` (count + auto-dispara notificação 1x por sessão).
- **Banner:** `UncategorizedBanner` (primary color, Sparkles) — usado no `FinanceiroDashboard` (navega para Extrato) e no `ExtratoBancario` (modo `inline` aplica o filtro local).
- **Filtro:** select "Categorização" no Extrato (Todas / Sem categoria / Com categoria) + suporte a `?filtro=sem-categoria` na URL (ativa filtro + período "todo").
- **CTA:** "Categorizar agora" → leva o usuário pra lista filtrada; ele clica em cada uma e o `SugestaoCategoriaModal` auto-abre.
