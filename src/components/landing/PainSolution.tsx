import {
  AlertTriangle,
  TrendingDown,
  Clock,
  Wallet,
  PieChart,
  ShieldCheck,
  Sparkles,
  Zap,
  Workflow,
  Database,
} from "lucide-react";

const dores = [
  { icon: TrendingDown, title: "Decisões cegas", desc: "Você só descobre o resultado do mês quando já passou." },
  { icon: AlertTriangle, title: "Erros e juros", desc: "Boletos perdidos, conciliação manual, divergências constantes." },
  { icon: Database, title: "Dados espalhados", desc: "Cliente em um sistema, contrato em outro, financeiro em planilha." },
  { icon: Clock, title: "Tempo do time desperdiçado", desc: "Horas semanais em tarefas repetitivas que poderiam ser automáticas." },
];

const solucoes = [
  { icon: Wallet, title: "Open Finance integrado", desc: "Bancos e cartões sincronizados em tempo real, sem digitação." },
  { icon: PieChart, title: "DRE e fluxo automáticos", desc: "Plano de contas + classificação por IA. Resultado vivo, sempre." },
  { icon: Sparkles, title: "IA aplicada à operação", desc: "Scanner de boletos, sugestão de categoria, resumo do cliente." },
  { icon: Workflow, title: "Automações sem código", desc: "Workflows por gatilho, notificações e integrações via webhook." },
];

export const PainSolution = () => {
  return (
    <section id="dores" className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-12 reveal">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-destructive/20 bg-destructive/5 text-[11px] text-destructive mb-4">
            <AlertTriangle className="w-3 h-3" /> DORES QUE O ORKS RESOLVE
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Está cansado de gerir tudo no{" "}
            <span className="text-muted-foreground line-through decoration-destructive/60">
              improviso?
            </span>
          </h2>
          <p className="mt-5 text-muted-foreground text-base md:text-lg">
            Existe um caminho mais profissional, mais previsível e livre de retrabalho.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Dores */}
          <div className="rounded-3xl border border-border bg-surface p-7 md:p-8 reveal">
            <div className="text-xs uppercase tracking-[0.2em] text-destructive/80 mb-5">
              O problema
            </div>
            <h3 className="font-display text-2xl font-semibold mb-6">
              O que freia o crescimento da sua empresa
            </h3>
            <ul className="space-y-4">
              {dores.map((d) => (
                <li key={d.title} className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                    <d.icon className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{d.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{d.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Soluções */}
          <div className="relative rounded-3xl bg-surface p-7 md:p-8 gradient-border overflow-hidden reveal">
            <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
            <div className="text-xs uppercase tracking-[0.2em] text-primary mb-5 relative">
              A solução Orks
            </div>
            <h3 className="font-display text-2xl font-semibold mb-6 relative">
              Como entregamos resultado
            </h3>
            <ul className="space-y-4 relative">
              {solucoes.map((s) => (
                <li key={s.title} className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shrink-0 shadow-glow-sm">
                    <s.icon className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
