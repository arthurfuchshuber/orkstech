import { ArrowRight, BarChart3, Users, Shield, Zap, TrendingUp, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PricingCards } from "@/components/billing/PricingCards";

const features = [
  {
    icon: BarChart3,
    title: "Financeiro Completo",
    description: "Contas a pagar/receber, fluxo de caixa, DRE, conciliação bancária e relatórios avançados.",
  },
  {
    icon: Users,
    title: "Customer Success",
    description: "Gestão de saúde do cliente, NPS, churn prediction, playbooks automatizados e health score.",
  },
  {
    icon: Layers,
    title: "Clientes & Fornecedores",
    description: "Base unificada com histórico completo, documentos, contratos e timeline de interações.",
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    description: "Workflows personalizados, triggers por evento, integrações via API e webhooks nativos.",
  },
  {
    icon: Shield,
    title: "Segurança Enterprise",
    description: "Criptografia ponta a ponta, audit logs, controle de acesso granular e compliance LGPD.",
  },
  {
    icon: TrendingUp,
    title: "Analytics & BI",
    description: "Dashboards customizáveis, KPIs em tempo real, previsões com IA e exportação de dados.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime garantido" },
  { value: "50k+", label: "Transações/dia" },
  { value: "3x", label: "Mais produtividade" },
  { value: "<2s", label: "Tempo de resposta" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">NexusOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Métricas</a>
            <a href="#cta" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Começar</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/app")}>
              Login
            </Button>
            <Button size="sm" className="glow" onClick={() => navigate("/app")}>
              Começar grátis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Plataforma de Operações Financeiras + CS
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-foreground">Gerencie suas</span>
              <br />
              <span className="gradient-text">operações financeiras</span>
              <br />
              <span className="text-foreground">em um só lugar</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Financeiro, Customer Success, Clientes, Fornecedores e Automações integrados 
              em uma plataforma poderosa para prestadores de serviço de todos os portes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="glow text-base px-8 h-12" onClick={() => navigate("/app")}>
                Iniciar agora <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60">
                Ver demonstração <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 border-y border-border/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center animate-fade-in">
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Tudo que você precisa, <span className="gradient-text">integrado</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Módulos poderosos que trabalham juntos para maximizar a eficiência da sua operação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl glass hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-border/40 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary mb-4">
              <Sparkles className="w-3 h-3" />
              Planos & Preços
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Escolha o plano <span className="gradient-text">ideal</span> para sua operação
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comece com 7 dias grátis. Sem cartão de crédito durante o teste. Cancele quando quiser.
            </p>
          </div>
          <PricingCards publicMode />
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="p-12 rounded-2xl glass glow animate-pulse-glow">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Pronto para <span className="gradient-text">transformar</span> sua operação?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Comece gratuitamente e escale conforme cresce. Sem cartão de crédito.
            </p>
            <Button size="lg" className="glow text-base px-10 h-12" onClick={() => navigate("/app")}>
              Começar agora <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">N</span>
            </div>
            <span className="text-sm font-semibold text-foreground">NexusOS</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <a href="/termos" className="hover:text-foreground transition-colors">Termos de Uso</a>
            <a href="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</a>
            <span className="hidden md:inline">© 2026 NexusOS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
