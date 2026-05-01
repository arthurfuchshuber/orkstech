import { useMemo, useState } from "react";
import { Check, X, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const planilhas = {
  horas: 24,
  retrabalho: "Alto",
  visibilidade: "Mensal",
  erros: "Frequentes",
};

const orksOp = {
  horas: 4,
  retrabalho: "Quase zero",
  visibilidade: "Tempo real",
  erros: "Raros",
};

export const RoiCompare = () => {
  const navigate = useNavigate();
  const [horas, setHoras] = useState<string>("24");

  const economia = useMemo(() => {
    const h = Number(horas.replace(/\D/g, "")) || 0;
    // 4h restantes com Orks; valor-hora gerencial estimado em R$ 80
    const horasSalvas = Math.max(0, h - 4);
    const reais = horasSalvas * 80 * 4; // por mês
    return { horasSalvas, reais };
  }, [horas]);

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <section id="comparativo" className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-12 reveal">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-5">
            <TrendingUp className="size-3.5 text-primary" />
            Comparativo de operação
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            O que sua equipe leva <span className="gradient-text">uma semana</span>{" "}
            para fechar, o Orks resolve em <span className="gradient-text">horas.</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-base md:text-lg">
            Compare lado a lado: rotina financeira em planilhas vs. operação no Orks.
          </p>
        </div>

        {/* Comparativo */}
        <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto reveal">
          {/* Planilhas */}
          <div className="rounded-3xl border border-border bg-surface p-7 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-semibold">Planilhas + sistemas isolados</h3>
              <span className="text-xs text-muted-foreground">Hoje</span>
            </div>
            <div className="space-y-4">
              <Row label="Horas/semana fechando o mês" value={`${planilhas.horas}h`} />
              <Row label="Retrabalho" value={planilhas.retrabalho} text />
              <Row label="Visibilidade dos números" value={planilhas.visibilidade} text />
              <Row label="Erros e divergências" value={planilhas.erros} text />
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <Bad>Conciliação bancária manual</Bad>
              <Bad>Histórico do cliente espalhado</Bad>
              <Bad>DRE e fluxo defasados</Bad>
            </ul>
          </div>

          {/* Orks */}
          <div className="relative rounded-3xl p-7 md:p-8 bg-surface gradient-border shadow-elegant overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative">
              <h3 className="font-display text-xl font-semibold">Orks Gestão 360º</h3>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-primary text-primary-foreground shadow-glow-sm">
                Recomendado
              </span>
            </div>
            <div className="space-y-4 relative">
              <Row label="Horas/semana fechando o mês" value={`${orksOp.horas}h`} highlight />
              <Row label="Retrabalho" value={orksOp.retrabalho} text />
              <Row label="Visibilidade dos números" value={orksOp.visibilidade} text />
              <Row label="Erros e divergências" value={orksOp.erros} text />
            </div>
            <ul className="mt-6 space-y-2 text-sm relative">
              <Good>Open Finance + categorização por IA</Good>
              <Good>Workspace 360º por cliente</Good>
              <Good>DRE e fluxo em tempo real</Good>
            </ul>
            <div className="mt-7 relative">
              <Button
                onClick={() => navigate("/register")}
                className="w-full bg-gradient-primary hover:opacity-95 text-primary-foreground rounded-full h-11 shadow-glow-sm font-semibold"
              >
                Quero esse ganho na minha operação
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calculadora */}
        <div className="max-w-3xl mx-auto mt-16 reveal">
          <div className="glass-strong rounded-3xl p-7 md:p-10 gradient-border relative overflow-hidden noise">
            <div className="absolute -top-32 -left-20 h-64 w-64 bg-primary/30 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                <span className="size-1.5 rounded-full bg-primary" />
                Quanto sua empresa pode economizar
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-semibold">
                Quantas horas/semana sua equipe gasta hoje em{" "}
                <span className="gradient-text">rotina financeira</span>?
              </h3>
              <p className="text-muted-foreground mt-2">
                Considere planilhas, conciliação bancária, cobrança, contas a pagar e fechamento.
              </p>

              <div className="mt-6 grid sm:grid-cols-[1fr_auto] gap-3">
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    className="h-14 pl-4 pr-16 text-lg bg-background border-border rounded-2xl"
                    placeholder="24"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    horas
                  </span>
                </div>
                <Button
                  onClick={() => navigate("/register")}
                  className="h-14 px-7 bg-gradient-primary hover:opacity-95 text-primary-foreground rounded-2xl font-semibold shadow-glow-sm"
                >
                  Testar grátis
                </Button>
              </div>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <div className="text-xs text-muted-foreground">Horas economizadas/mês</div>
                  <div className="font-display text-2xl font-bold mt-1">
                    {economia.horasSalvas * 4}h
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-glow-sm">
                  <div className="text-xs opacity-90">Custo operacional poupado</div>
                  <div className="font-display text-2xl md:text-3xl font-bold mt-1">
                    {formatBRL(economia.reais)}
                    <span className="text-sm font-medium opacity-90 ml-2">/ mês</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                * Estimativa considerando R$ 80/h de custo médio gerencial e ~4h/semana residuais com o Orks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

function Row({
  label,
  value,
  highlight,
  text,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  text?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-display font-semibold ${
          highlight
            ? "gradient-text text-xl"
            : text
            ? "text-foreground/80 text-sm font-medium"
            : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Good({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="size-3" />
      </span>
      <span className="text-foreground/90">{children}</span>
    </li>
  );
}
function Bad({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <X className="size-3" />
      </span>
      <span>{children}</span>
    </li>
  );
}
