import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";

export default function CadastrosFinanceiros() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Plano Financeiro</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Plano de contas, centros de custo e formas de pagamento</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PlanoDeContasSection />
        <CentrosCustoSection />
      </div>

      <FormasPagamentoSection />
    </div>
  );
}
