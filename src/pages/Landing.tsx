import {
  ArrowRight,
  BarChart3,
  Users,
  Shield,
  Zap,
  TrendingUp,
  Layers,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Wallet,
  PieChart,
  Workflow,
  Database,
  MessageSquare,
  Star,
  HelpCircle,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PricingCards } from "@/components/billing/PricingCards";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import orksLogo from "@/assets/orks-icon.png";
import { OrksWordmark } from "@/components/OrksWordmark";

// ──────────────────────────────────────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────────────────────────────────────

const stats = [
  { value: "99.9%", label: "Uptime garantido" },
  { value: "50k+", label: "Transações/dia" },
  { value: "3x", label: "Mais produtividade" },
  { value: "<2s", label: "Tempo de resposta" },
];

const trustedBy = ["Construtech", "LegalCorp", "Anfitrião Sigma", "Visium", "Northwind", "Helio"];

const financePains = [
  {
    icon: AlertTriangle,
    pain: "Boletos perdidos e juros acumulando",
    solution: "Scanner de boletos por IA + alertas automáticos de vencimento. Zero contas atrasadas.",
  },
  {
    icon: Wallet,
    pain: "Conciliação bancária manual e demorada",
    solution: "Open Finance integrado: transações sincronizadas em tempo real e categorizadas com IA.",
  },
  {
    icon: PieChart,
    pain: "DRE travado em planilhas que ninguém entende",
    solution: "DRE dinâmico construído sobre seu Plano de Contas, com regras de classificação automática.",
  },
  {
    icon: TrendingUp,
    pain: "Fluxo de caixa imprevisível e fora de controle",
    solution: "Dashboard 360º: caixa atual, contas a pagar, projeções e indicadores em tempo real.",
  },
];

const integrationPains = [
  {
    icon: Database,
    pain: "Histórico do cliente espalhado em 5 sistemas diferentes",
    solution: "Workspace 360º do cliente: financeiro, contratos, documentos e timeline em uma só tela.",
  },
  {
    icon: Scale,
    pain: "Contratos jurídicos desconectados da operação financeira",
    solution: "Integração ClickSign nativa: contratos vinculados ao cliente, lembretes e renovações automáticas.",
  },
  {
    icon: FileText,
    pain: "Documentos perdidos entre e-mails, drives e WhatsApps",
    solution: "Repositório centralizado por cliente, com anexos, versionamento e busca instantânea.",
  },
  {
    icon: Workflow,
    pain: "Tarefas manuais repetitivas que consomem o time",
    solution: "Engine de automações: gatilhos por evento, notificações e workflows sem código.",
  },
];

const features = [
  {
    icon: BarChart3,
    title: "Dashboard 360º Financeiro",
    description: "Visão unificada de caixa, cartões, contas a pagar/receber e projeções em tempo real.",
  },
  {
    icon: Wallet,
    title: "Open Finance Integrado",
    description: "Conecte bancos e cartões via Pluggy. Conciliação automática e categorização com IA.",
  },
  {
    icon: PieChart,
    title: "DRE & Plano de Contas",
    description: "Hierarquia drag-and-drop, regras de classificação automática e relatórios contábeis.",
  },
  {
    icon: Users,
    title: "Workspace 360º do Cliente",
    description: "Histórico completo: financeiro, contratos, atividades e documentos em uma só tela.",
  },
  {
    icon: Scale,
    title: "Contratos & Jurídico",
    description: "ClickSign nativo, gestão de contratos vinculados ao cliente e ao financeiro.",
  },
  {
    icon: Workflow,
    title: "Automações Inteligentes",
    description: "Workflows por gatilho, notificações e integrações via API e webhooks.",
  },
  {
    icon: Shield,
    title: "Segurança Enterprise",
    description: "Multi-tenant com RLS, audit logs, controle granular de permissões e compliance LGPD.",
  },
  {
    icon: Sparkles,
    title: "IA Aplicada à Operação",
    description: "Scanner de boletos, sugestão de categorização e resumos inteligentes do cliente.",
  },
  {
    icon: TrendingUp,
    title: "Multi-empresa",
    description: "Gerencie várias empresas em uma só conta, com isolamento total de dados.",
  },
];

const useCases = [
  {
    persona: "Escritórios de Serviços",
    description: "Advocacia, contabilidade, arquitetura, consultorias.",
    benefits: ["Gestão de clientes recorrentes", "Contratos + financeiro integrados", "DRE por centro de custo"],
  },
  {
    persona: "Prestadores B2B",
    description: "Agências, devhouses, marketing, eventos.",
    benefits: ["Recebíveis automatizados", "Workspace por cliente", "Cobranças via Asaas"],
  },
  {
    persona: "PMEs em Crescimento",
    description: "Startups e empresas em escala que precisam profissionalizar.",
    benefits: ["Multi-empresa nativo", "Open Finance + DRE", "Permissões por equipe"],
  },
];

const testimonials = [
  {
    quote: "Substituímos 4 ferramentas (planilha, ERP simples, sistema de cobrança e drive) por uma só. Economia clara e time muito mais produtivo.",
    author: "Diretora Financeira",
    role: "Escritório de Advocacia",
  },
  {
    quote: "O scanner de boletos por IA sozinho já paga o plano. Em 30 segundos lanço o que antes levava 5 minutos.",
    author: "Sócio Administrador",
    role: "Consultoria de TI",
  },
  {
    quote: "Finalmente vejo o fluxo de caixa em tempo real, sem depender do contador me mandar planilha no fim do mês.",
    author: "CEO",
    role: "Agência Digital",
  },
];

const comparison = [
  { feature: "Dashboard financeiro 360º em tempo real", orks: true, sheets: false, generic: false },
  { feature: "Open Finance (sync bancário)", orks: true, sheets: false, generic: true },
  { feature: "Scanner de boletos por IA", orks: true, sheets: false, generic: false },
  { feature: "DRE com regras automáticas", orks: true, sheets: false, generic: true },
  { feature: "Workspace 360º do cliente", orks: true, sheets: false, generic: false },
  { feature: "Contratos (ClickSign) integrados", orks: true, sheets: false, generic: false },
  { feature: "Multi-empresa nativo", orks: true, sheets: true, generic: false },
  { feature: "Automações sem código", orks: true, sheets: false, generic: true },
];

const faqs = [
  {
    q: "Quanto tempo leva para começar?",
    a: "Menos de 5 minutos. Você cria a conta, valida o CNPJ via Receita Federal e já tem acesso ao Dashboard. A importação do plano de contas e cadastros pode ser feita por planilha ou manualmente.",
  },
  {
    q: "Vocês têm integração com meu banco?",
    a: "Sim. Via Pluggy (Open Finance), suportamos os principais bancos do Brasil (Itaú, Bradesco, Santander, BB, Caixa, Inter, Nubank, C6, e muitos outros), com sincronização automática de extratos e cartões.",
  },
  {
    q: "Posso gerenciar mais de uma empresa?",
    a: "Sim. O Orks é multi-empresa nativo. Os planos definem o número máximo de empresas ativas, e os dados ficam totalmente isolados por empresa.",
  },
  {
    q: "Existe trial gratuito?",
    a: "Sim. 7 dias gratuitos em qualquer plano, sem cartão de crédito. Após o trial, você escolhe o plano que cabe na sua operação.",
  },
  {
    q: "Como funciona a segurança e LGPD?",
    a: "Criptografia em trânsito e em repouso, multi-tenant com Row-Level Security, audit logs completos, backups diários e conformidade LGPD. Seus dados são seus — você pode exportá-los a qualquer momento.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade, sem multa. Cancele direto pelo portal de assinatura a qualquer momento.",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-background/70 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            <OrksWordmark size="text-2xl" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground tracking-[0.25em] uppercase border-l border-border/40 pl-3">Gestão 360º</span>
          </a>
          <div className="hidden md:flex items-center gap-7">
            <a href="#dores" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dores resolvidas</a>
            <a href="#produto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Produto</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" className="glow" onClick={() => navigate("/register")}>
              Começar grátis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] text-xs text-primary mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-medium tracking-wide">PLATAFORMA DE GESTÃO 360º — FINANCEIRO + CLIENTES + JURÍDICO</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-foreground">
              Toda a operação da sua empresa
              <br />
              <span className="gradient-text">em uma única tela.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Financeiro, clientes, contratos e operação integrados. Pare de pular entre planilhas, sistemas e e-mails — o Orks unifica tudo com automação e IA.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="glow text-base px-8 h-12 w-full sm:w-auto" onClick={() => navigate("/register")}>
                Começar grátis por 7 dias <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 w-full sm:w-auto" onClick={() => navigate("/login")}>
                Já sou cliente <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-5">Sem cartão de crédito • Cancele quando quiser • Suporte em português</p>
          </div>

          {/* Hero mockup */}
          <div className="mt-16 relative animate-fade-in">
            <div className="absolute -inset-x-20 -top-10 -bottom-10 bg-primary/5 blur-3xl pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-[0_40px_120px_-30px_hsl(217_100%_30%/0.6)] glass">
              <div className="h-9 bg-card/80 border-b border-border/40 flex items-center gap-2 px-4">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                <div className="ml-3 text-[11px] text-muted-foreground">orks.com.br/app/financas/dashboard</div>
              </div>
              <div className="p-6 md:p-10 bg-gradient-to-br from-card to-background">
                <div className="grid md:grid-cols-4 gap-3 mb-4">
                  {[
                    { l: "Caixa total", v: "R$ 487.230", c: "text-success" },
                    { l: "A pagar", v: "R$ 92.140", c: "text-warning" },
                    { l: "A receber", v: "R$ 312.890", c: "text-primary" },
                    { l: "Resultado mês", v: "+18.4%", c: "text-success" },
                  ].map((k) => (
                    <div key={k.l} className="p-4 rounded-lg bg-background/60 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{k.l}</div>
                      <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 h-44 rounded-lg bg-background/60 border border-border/40 p-4">
                    <div className="text-xs text-muted-foreground mb-3">Fluxo de caixa — últimos 6 meses</div>
                    <div className="flex items-end gap-2 h-28">
                      {[40, 65, 55, 80, 72, 95].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="h-44 rounded-lg bg-background/60 border border-border/40 p-4">
                    <div className="text-xs text-muted-foreground mb-3">Top categorias DRE</div>
                    <div className="space-y-2">
                      {[
                        { l: "Receita Serviços", v: 92 },
                        { l: "Despesas Op.", v: 64 },
                        { l: "Folha", v: 48 },
                        { l: "Impostos", v: 32 },
                      ].map((c) => (
                        <div key={c.l}>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5"><span>{c.l}</span><span>{c.v}%</span></div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${c.v}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by / Stats */}
      <section className="py-12 border-y border-border/40 bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">Empresas que confiam no Orks</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-12 opacity-60">
            {trustedBy.map((name) => (
              <span key={name} className="text-sm font-semibold tracking-wide text-muted-foreground">{name}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{s.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dores resolvidas — Financeiro */}
      <section id="dores" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-destructive/20 bg-destructive/5 text-xs text-destructive mb-4">
              <AlertTriangle className="w-3 h-3" /> DORES QUE O ORKS RESOLVE
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              Sua área financeira <span className="gradient-text">não precisa ser um caos.</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Substituímos planilhas frágeis, ERPs caros e processos manuais por uma plataforma única, automatizada e inteligente.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-20">
            {financePains.map((p) => (
              <div key={p.pain} className="group p-6 rounded-2xl bg-gradient-to-br from-card to-card/40 border border-border/50 hover:border-primary/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground line-through mb-2">{p.pain}</p>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground leading-relaxed">{p.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Integração de dados */}
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              Cliente, jurídico e financeiro <span className="gradient-text">finalmente conversam.</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Um só histórico, uma só verdade. Tudo conectado — do contrato à última fatura paga.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {integrationPains.map((p) => (
              <div key={p.pain} className="group p-6 rounded-2xl bg-gradient-to-br from-card to-card/40 border border-border/50 hover:border-primary/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground line-through mb-2">{p.pain}</p>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground leading-relaxed">{p.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Produto / Features */}
      <section id="produto" className="py-24 border-t border-border/40 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/[0.04] blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary mb-4">
              <Layers className="w-3 h-3" /> PRODUTO
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              Tudo que você precisa, <span className="gradient-text">integrado.</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Módulos poderosos que trabalham juntos para maximizar a eficiência da sua operação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-xl bg-card/60 border border-border/40 hover:border-primary/40 hover:bg-card transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Casos de uso */}
      <section className="py-24 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Feito para <span className="gradient-text">prestadores de serviço</span> de todos os portes
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {useCases.map((u) => (
              <div key={u.persona} className="p-7 rounded-2xl bg-gradient-to-br from-card to-card/30 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-1">{u.persona}</h3>
                <p className="text-sm text-muted-foreground mb-5">{u.description}</p>
                <ul className="space-y-2.5">
                  {u.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-24 border-t border-border/40 bg-card/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-warning/20 bg-warning/5 text-xs text-warning mb-4">
              <Star className="w-3 h-3 fill-current" /> DEPOIMENTOS
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Quem usa, <span className="gradient-text">recomenda.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border/50 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <MessageSquare className="w-5 h-5 text-primary/40 mb-3" />
                <p className="text-sm text-foreground/90 leading-relaxed mb-5 flex-1">"{t.quote}"</p>
                <div className="pt-4 border-t border-border/40">
                  <div className="text-sm font-semibold text-foreground">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section className="py-24 border-t border-border/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Por que migrar para o <span className="gradient-text">Orks?</span>
            </h2>
            <p className="text-muted-foreground text-lg">Compare e veja a diferença em segundos.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card">
            <div className="grid grid-cols-4 bg-card/80 border-b border-border/40">
              <div className="p-4 text-xs uppercase tracking-wider text-muted-foreground">Funcionalidade</div>
              <div className="p-4 text-center text-xs uppercase tracking-wider text-primary font-semibold">Orks</div>
              <div className="p-4 text-center text-xs uppercase tracking-wider text-muted-foreground">Planilhas</div>
              <div className="p-4 text-center text-xs uppercase tracking-wider text-muted-foreground">ERP genérico</div>
            </div>
            {comparison.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 ${i % 2 === 0 ? "bg-background/40" : "bg-card/40"} border-b border-border/30 last:border-b-0`}>
                <div className="p-4 text-sm text-foreground">{row.feature}</div>
                <div className="p-4 flex justify-center">
                  {row.orks ? <Check className="w-5 h-5 text-success" /> : <X className="w-5 h-5 text-muted-foreground/40" />}
                </div>
                <div className="p-4 flex justify-center">
                  {row.sheets ? <Check className="w-5 h-5 text-muted-foreground" /> : <X className="w-5 h-5 text-muted-foreground/40" />}
                </div>
                <div className="p-4 flex justify-center">
                  {row.generic ? <Check className="w-5 h-5 text-muted-foreground" /> : <X className="w-5 h-5 text-muted-foreground/40" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-24 border-t border-border/40 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary mb-4">
              <Sparkles className="w-3 h-3" /> PLANOS
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              Escolha o plano <span className="gradient-text">ideal</span> para sua operação
            </h2>
            <p className="text-muted-foreground text-lg">
              Comece com 7 dias grátis. Sem cartão de crédito durante o teste. Cancele quando quiser.
            </p>
          </div>
          <PricingCards publicMode />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 border-t border-border/40">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary mb-4">
              <HelpCircle className="w-3 h-3" /> FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Perguntas <span className="gradient-text">frequentes</span>
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="rounded-xl border border-border/50 bg-card/60 px-5 data-[state=open]:border-primary/30">
                <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 border-t border-border/40 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-br from-card via-card to-primary/[0.08] border border-primary/30 shadow-[0_40px_120px_-30px_hsl(217_100%_30%/0.5)] text-center">
            <div className="w-20 h-20 mx-auto mb-6 drop-shadow-[0_10px_40px_hsl(var(--primary)/0.55)]">
              <img src={orksLogo} alt="Orks" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground leading-tight">
              Pronto para <span className="gradient-text">profissionalizar</span> sua operação?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg max-w-xl mx-auto">
              Junte-se a empresas que já trocaram o caos por uma gestão 360º de verdade. 7 dias grátis, sem cartão.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="glow text-base px-10 h-12 w-full sm:w-auto" onClick={() => navigate("/register")}>
                Começar agora <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 w-full sm:w-auto" onClick={() => navigate("/login")}>
                Falar com vendas
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Sem cartão</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> 7 dias grátis</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Cancele quando quiser</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10 bg-card/20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <OrksWordmark size="text-xl" />
            <span className="text-[10px] text-muted-foreground tracking-[0.25em] uppercase border-l border-border/40 pl-3">Gestão 360º</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <a href="/termos" className="hover:text-foreground transition-colors">Termos de Uso</a>
            <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <span>© 2026 Orks · By Anfitrião Sigma</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
