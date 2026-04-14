import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";
import { CategoriasCadastroSection } from "@/components/financas/CategoriasCadastroSection";

export default function CadastrosFinanceiros() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Plano Financeiro</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Centros de custo, formas de pagamento e categorias</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CentrosCustoSection />
        <FormasPagamentoSection />
        <CategoriasCadastroSection />
      </div>
    </div>
  );
}
