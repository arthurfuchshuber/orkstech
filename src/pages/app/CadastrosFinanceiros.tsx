import { Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";

export default function CadastrosFinanceiros() {
  return (
    <div className="space-y-8 animate-fade-in max-w-6xl">
      <div className="flex items-center gap-3">
        <Settings2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Cadastros Financeiros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plano de contas, centros de custo e formas de pagamento</p>
        </div>
      </div>

      <PlanoDeContasSection />

      <Separator className="my-2" />

      <CentrosCustoSection />

      <Separator className="my-2" />

      <FormasPagamentoSection />
    </div>
  );
}
