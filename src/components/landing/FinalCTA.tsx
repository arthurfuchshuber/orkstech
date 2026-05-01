import { ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative max-w-5xl mx-auto rounded-[2rem] overflow-hidden p-10 md:p-16 text-center reveal gradient-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/10 backdrop-blur-xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
          <div className="absolute inset-0 noise opacity-30" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-7">
              <Clock className="size-3.5 text-primary" />
              7 dias grátis · cancele quando quiser
            </div>

            <h2 className="font-display text-3xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] text-balance">
              Sua operação pode estar{" "}
              <span className="gradient-text italic">rendendo mais.</span>
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
              Comece em menos de 5 minutos. Conecte seu banco, importe sua planilha e veja sua empresa em uma única tela.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="group bg-gradient-primary hover:opacity-95 text-primary-foreground rounded-full h-14 px-8 text-base font-semibold shadow-glow"
              >
                Começar grátis agora
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                className="bg-transparent border-border hover:bg-card text-foreground rounded-full h-14 px-8 text-base font-semibold"
              >
                Já sou cliente
              </Button>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> 7 dias grátis
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Cancele quando quiser
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Suporte em português
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
