import {
  ArrowRight,
  BarChart3,
  Wallet,
  PieChart,
  Users,
  Scale,
  FileText,
  Workflow,
  Sparkles,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const financeiro = [
  { icon: BarChart3, label: "Dashboard 360º em tempo real" },
  { icon: Wallet, label: "Open Finance (Pluggy) integrado" },
  { icon: PieChart, label: "DRE + plano de contas dinâmico" },
  { icon: Sparkles, label: "Scanner de boletos por IA" },
];

const operacao = [
  { icon: Users, label: "Workspace 360º por cliente" },
  { icon: Scale, label: "Contratos ClickSign nativos" },
  { icon: FileText, label: "Documentos centralizados" },
  { icon: Workflow, label: "Automações por gatilho" },
  { icon: Shield, label: "Multi-empresa com RLS" },
];

export const Modules = () => {
  const navigate = useNavigate();

  return (
    <section id="produto" className="py-20 md:py-28 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/[0.04] blur-3xl pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-12 reveal">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-5 whitespace-nowrap">
            Dois pilares. Uma plataforma.
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-balance leading-[1.15]">
            Tudo que você precisa,{" "}
            <span className="gradient-text">de verdade integrado.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Financeiro */}
          <div className="group relative rounded-3xl bg-surface border border-border p-8 md:p-10 transition-all duration-500 hover:border-primary/40 hover:shadow-elegant reveal overflow-hidden">
            <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.2em] text-foreground mb-3">
                01 — Financeiro inteligente
              </div>
              <h3 className="font-display text-xl sm:text-2xl md:text-4xl font-bold leading-tight text-balance">
                Seu dinheiro, <span className="gradient-text">sob controle total.</span>
              </h3>
              <p className="mt-4 text-muted-foreground">
                Da entrada do extrato até o fechamento do mês: bancos sincronizados, classificação automática e DRE vivo.
              </p>

              <ul className="mt-7 space-y-3">
                {financeiro.map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-4" />
                    </span>
                    <span className="text-sm">{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => navigate("/register")}
                className="mt-8 w-full bg-gradient-primary hover:opacity-95 text-primary-foreground rounded-full h-12 font-semibold shadow-glow-sm group/btn"
              >
                Conhecer o financeiro
                <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </div>
          </div>

          {/* Operação */}
          <div className="group relative rounded-3xl bg-surface border border-border p-8 md:p-10 transition-all duration-500 hover:border-primary/40 hover:shadow-elegant reveal overflow-hidden">
            <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.2em] text-foreground mb-3">
                02 — Operação 360º
              </div>
              <h3 className="font-display text-xl sm:text-2xl md:text-4xl font-bold leading-tight text-balance">
                Cliente, contrato e operação{" "}
                <span className="gradient-text">conversando entre si.</span>
              </h3>
              <p className="mt-4 text-muted-foreground">
                Histórico completo do cliente em uma só tela: financeiro, contratos, documentos, atividades e automações.
              </p>

              <ul className="mt-7 space-y-3">
                {operacao.map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-4" />
                    </span>
                    <span className="text-sm">{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => navigate("/register")}
                variant="outline"
                className="mt-8 w-full bg-transparent border-border hover:bg-card rounded-full h-12 font-semibold group/btn"
              >
                Conhecer a operação 360º
                <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
