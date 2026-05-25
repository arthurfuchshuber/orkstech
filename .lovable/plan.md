## Direção visual confirmada
Linear/Vercel ultra clean + hierarquia/espaçamentos premium do Stripe, mantendo o dark mode atual. Navegação híbrida: **bottom tab bar fixa** (Dashboard, Reservas, Financeiro, Operações, Mais) + **gaveta (Sheet)** para sub-níveis e telas administrativas. Sidebar atual continua intacta em desktop (≥ md).

---

## Fase 1 — Shell global (PRIMEIRA ENTREGA)
**O que muda:** infraestrutura visual presente em 100% das páginas.

- **Tokens & utilitários mobile:** adicionar `safe-area-inset` (env safe-area), classes `pb-safe`, `pt-safe`; trocar `h-screen` por `h-dvh` no shell; criar `--header-h-mobile: 56px`, `--bottom-tab-h: 64px`.
- **AppLayout (`src/components/AppLayout.tsx`):**
  - `< md`: oculta sidebar permanente; adiciona top header sticky compacto (56px) com logo, busca colapsada (ícone), avatar.
  - `≥ md`: comportamento atual (sidebar lateral).
  - Conteúdo recebe `pb-[calc(var(--bottom-tab-h)+env(safe-area-inset-bottom))]` no mobile.
- **Novo componente `MobileBottomTabBar.tsx`:**
  - Fixed bottom, blur backdrop, border-top sutil, safe-area-inset-bottom.
  - 5 slots: Dashboard / Reservas / Financeiro / Operações / Mais.
  - Indicador ativo (linha superior + label highlight) usando `useLocation`.
  - Tap target ≥ 56×56, ícones `lucide` 20px.
- **Novo componente `MobileMenuSheet.tsx`** (acionado por "Mais" e por ícone superior):
  - Sheet lado direito, full-height, scroll interno, com a árvore completa do menu dinâmico (níveis 2/3), seletor de empresa, link para Configurações, sair.
- **AppSidebar:** em < md vira inerte (não renderiza), exporta `useSidebarMenu()` que alimenta tanto a sidebar desktop quanto o `MobileMenuSheet`.
- **CompanySelector:** versão compacta mobile dentro do MobileMenuSheet (não no header).

**Validação:** preview mobile (375×812 iPhone SE, 390×844 iPhone 14, 414×896 Pro Max). Zero scroll horizontal, tap targets ≥44px, bottom bar respeita safe area.

---

## Fase 2 — Dashboard 360 + KPIs financeiros
- `FinanceiroDashboard` e `CaixaKpis`: grid 2×N em desktop → stack vertical 1×N em mobile, com KPI cards full-width, tipografia escalando via `text-xs/sm/base` por breakpoint.
- `KpiHoverCard`: detectar `useIsMobile()` → tap abre Sheet bottom (em vez de Popover hover).
- Gráficos (Recharts): height adaptativo, eixos com `tickFontSize` menor, tooltip nativo touch-friendly.
- Filtros do dashboard viram chips horizontais com scroll-snap em mobile.

## Fase 3 — Listas grandes (Contas a Pagar, Extrato, Clientes, Fornecedores, Cartões)
- Padrão único: componente `ResponsiveDataTable` → em desktop renderiza `<table>` atual com % de largura; em < md renderiza lista de `<ListItemCard>` (uma transação/lançamento por card, descrição em destaque, valor à direita, badges abaixo).
- Ações (ChevronDown dropdown) em mobile → `Sheet` bottom com lista de ações grandes (≥48px).
- Filtros e busca: sticky abaixo do header, com chips de filtros ativos.

## Fase 4 — Formulários e modais
- Todos os `Dialog` shadcn com `responsive=true` → vira `Drawer` (vaul) em < md, full-height, handle no topo.
- Inputs: `h-11` no mobile (44px), font-size ≥16px para evitar zoom no iOS.
- `ManagedSelect`: dropdown em mobile abre como Sheet com busca sticky no topo.
- Footers de modal com botões empilhados verticais em < sm, com primário em destaque.

---

## Plano técnico (resumo)

```text
src/
├── components/
│   ├── AppLayout.tsx                 [refatorar — shell mobile-first]
│   ├── AppSidebar.tsx                [extrair hook useSidebarMenu()]
│   ├── mobile/
│   │   ├── MobileBottomTabBar.tsx    [NOVO]
│   │   ├── MobileMenuSheet.tsx       [NOVO]
│   │   └── MobileTopBar.tsx          [NOVO]
│   ├── responsive/
│   │   ├── ResponsiveDataTable.tsx   [Fase 3]
│   │   ├── ResponsiveDialog.tsx      [Fase 4 — Dialog ↔ Drawer]
│   │   └── ListItemCard.tsx          [Fase 3]
│   └── ...
├── hooks/
│   └── use-mobile.tsx                [já existe — auditar e padronizar]
├── index.css                         [safe-area, --bottom-tab-h, --header-h-mobile]
└── tailwind.config.ts                [garantir h-dvh, safe utilities]
```

**Mobile breakpoints alvo:** 320 (SE 1ª gen), 360 (Android pequeno), 375 (iPhone SE 3), 390 (iPhone 14), 414 (Pro Max), 768 (iPad mini portrait → ainda mobile shell).

**Sem mudanças funcionais.** Toda lógica de negócio, RLS, queries e edge functions permanecem intactas. Apenas presentation/layout.

---

## Próximo passo
Se aprovado, começo executando **apenas a Fase 1 (Shell global)** e te mostro o resultado em mobile antes de avançar para a Fase 2. Cada fase será uma entrega validável.

Posso seguir?