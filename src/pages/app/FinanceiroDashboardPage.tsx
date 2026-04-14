import FinanceiroDashboard from "@/components/financas/FinanceiroDashboard";

export default function FinanceiroDashboardPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Visão 360° do financeiro da empresa: saldos, cartões, contas a pagar e indicadores.
        </p>
      </div>
      <FinanceiroDashboard />
    </div>
  );
}
