import { ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section
      id="top"
      className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto animate-fade-in-up">
          <div className="shimmer inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] text-[10px] sm:text-xs text-primary mb-6 sm:mb-8 backdrop-blur-sm max-w-full">
            <Sparkles className="size-3 sm:size-3.5" />
            <span className="font-medium tracking-wide truncate">
              GESTÃO 360º — FINANCEIRO + CLIENTES + JURÍDICO
            </span>
          </div>

          <h1 className="font-display text-[2rem] min-[380px]:text-[2.25rem] sm:text-[2.75rem] md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] sm:leading-[1.05] mb-5 sm:mb-6 text-foreground">
            <span className="block whitespace-nowrap">
              Toda a operação da sua
            </span>
            <span className="block gradient-text whitespace-nowrap">
              <span className="sm:hidden">empresa em uma</span>
              <span className="hidden sm:inline">empresa em uma única tela!</span>
            </span>
            <span className="block gradient-text whitespace-nowrap sm:hidden">
              única tela!
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Financeiro, clientes, contratos e operação integrados. Pare de pular entre planilhas, sistemas e e-mails — o Orks unifica tudo com automação e IA.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="group bg-gradient-primary hover:opacity-95 text-primary-foreground shadow-glow rounded-full px-7 h-12 text-base font-semibold pulse-glow w-full sm:w-auto"
            >
              Começar grátis por 7 dias
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-border bg-transparent hover:bg-card text-foreground rounded-full px-7 h-12 text-base font-semibold w-full sm:w-auto"
            >
              Já sou cliente
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>

          <p className="text-[11px] sm:text-xs text-muted-foreground mt-5 px-2">
            7 dias grátis • Cancele quando quiser • Suporte em português
          </p>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mt-12 reveal">
            {[
              { v: "99.9%", l: "Uptime garantido" },
              { v: "3x", l: "Mais produtividade" },
              { v: "<2s", l: "Tempo de resposta" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="font-display text-2xl md:text-3xl font-bold text-gradient">
                  {s.v}
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero mockup */}
        <div className="mt-12 sm:mt-16 relative reveal">
          <div className="absolute -inset-x-20 -top-10 -bottom-10 bg-primary/5 blur-3xl pointer-events-none" />
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-border/50 shadow-[0_40px_120px_-30px_hsl(217_100%_30%/0.6)] glass">
            <div className="h-8 sm:h-9 bg-card/80 border-b border-border/40 flex items-center gap-2 px-3 sm:px-4">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-destructive/60" />
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-warning/60" />
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-success/60" />
              <div className="ml-2 sm:ml-3 text-[9px] sm:text-[11px] text-muted-foreground truncate">
                orks.com.br/app/financas/dashboard
              </div>
            </div>
            <div className="p-3 sm:p-6 md:p-10 bg-gradient-to-br from-card to-background">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {[
                  { l: "Caixa total", v: "R$ 487.230", c: "text-success" },
                  { l: "A pagar", v: "R$ 92.140", c: "text-warning" },
                  { l: "A receber", v: "R$ 312.890", c: "text-primary" },
                  { l: "Resultado mês", v: "+18.4%", c: "text-success" },
                ].map((k) => (
                  <div key={k.l} className="p-2.5 sm:p-4 rounded-lg bg-background/60 border border-border/40">
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mb-1 truncate">
                      {k.l}
                    </div>
                    <div className={`text-sm sm:text-xl font-bold ${k.c} truncate`}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-2 sm:gap-3">
                <div className="md:col-span-2 h-32 sm:h-44 rounded-lg bg-background/60 border border-border/40 p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                    Fluxo de caixa — últimos 6 meses
                  </div>
                  <div className="flex items-end gap-1.5 sm:gap-2 h-20 sm:h-28">
                    {[40, 65, 55, 80, 72, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-auto sm:h-44 rounded-lg bg-background/60 border border-border/40 p-3 sm:p-4">
                  <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                    Top categorias DRE
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {[
                      { l: "Receita Serviços", v: 92 },
                      { l: "Despesas Op.", v: 64 },
                      { l: "Folha", v: 48 },
                      { l: "Impostos", v: 32 },
                    ].map((c) => (
                      <div key={c.l}>
                        <div className="flex justify-between text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">
                          <span className="truncate">{c.l}</span>
                          <span>{c.v}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${c.v}%` }}
                          />
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
  );
};
