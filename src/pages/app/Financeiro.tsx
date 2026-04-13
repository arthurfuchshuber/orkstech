import { Building2, CreditCard, Landmark, Settings2 } from "lucide-react";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";
import ContasBancarias from "./ContasBancarias";

export default function Financeiro() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Estruture o financeiro da operação em um único ambiente: plano de contas, centros de custo, formas de pagamento e contas bancárias.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Estrutura financeira</h2>
            <p className="text-xs text-muted-foreground">Defina a base contábil e operacional usada em lançamentos e relatórios.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <PlanoDeContasSection />
          <CentrosCustoSection />
          <FormasPagamentoSection />
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <ContasBancarias embedded />
          </div>
        </div>
      </section>
    </div>
  );
}
