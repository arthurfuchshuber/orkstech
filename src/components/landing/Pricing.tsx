import { Sparkles } from "lucide-react";
import { PricingCards } from "@/components/billing/PricingCards";

export const Pricing = () => {
  return (
    <section id="planos" className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-12 max-w-3xl mx-auto reveal">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-5">
            <Sparkles className="size-3.5 text-primary" />
            Planos
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4 text-balance leading-[1.15]">
            Escolha o plano <span className="gradient-text">ideal</span> para sua operação
          </h2>
          <p className="text-muted-foreground text-base md:text-lg text-pretty">
            Comece com 7 dias grátis em qualquer plano. Cancele quando quiser, sem multa.
          </p>
        </div>
        <div className="reveal">
          <PricingCards publicMode />
        </div>
      </div>
    </section>
  );
};
