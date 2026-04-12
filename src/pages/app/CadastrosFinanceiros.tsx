import { Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";

export default function CadastrosFinanceiros() {
  return (
    <div className="space-y-10 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Cadastros Financeiros</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie plano de contas, centros de custo e formas de pagamento em um só lugar</p>
      </div>

      <section>
        <PlanoDeContasSection />
      </section>

      <Separator />

      <section>
        <CentrosCustoSection />
      </section>

      <Separator />

      <section>
        <FormasPagamentoSection />
      </section>
    </div>
  );
}
