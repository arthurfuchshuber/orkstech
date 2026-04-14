import { Settings2, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";
import { CategoriasCadastroSection } from "@/components/financas/CategoriasCadastroSection";
import ContasBancarias from "./ContasBancarias";
import FinanceiroDashboard from "@/components/financas/FinanceiroDashboard";

interface FinanceiroProps {
  defaultTab?: string;
}

export default function Financeiro({ defaultTab = "visao-geral" }: FinanceiroProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Visão completa do financeiro da empresa: saldos, cartões, contas e cadastros.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/30 border border-border/40 rounded-lg p-1">
          <TabsTrigger value="visao-geral" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="cadastros" className="gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" />
            Cadastros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <FinanceiroDashboard />
        </TabsContent>

        <TabsContent value="cadastros" className="mt-4">
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
            </div>
            <ContasBancarias embedded />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <FormasPagamentoSection />
              <CategoriasCadastroSection />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
