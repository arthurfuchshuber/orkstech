import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { PLANS } from "@/hooks/useSubscription";
import { usePlans } from "@/hooks/usePlans";

export default function AdminPlans() {
  const { data: stripePlans, isLoading } = usePlans();

  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Planos & Preços</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visualize os planos configurados no Stripe</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(PLANS).map(([key, plan]) => {
          const stripePlan = stripePlans?.find((p) => p.product_id === plan.product_id);
          return (
            <Card key={key} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  {plan.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{fmt(plan.monthlyPrice)}</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>

                {stripePlan && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{stripePlan.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stripePlan.features?.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-border/30 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Mensal</span>
                    <span className="text-foreground">{stripePlan?.prices.monthly ? fmt(stripePlan.prices.monthly.amount) : fmt(plan.monthlyPrice)}</span>
                  </div>
                  {stripePlan?.prices.semiannual && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Semestral</span>
                      <span className="text-foreground">{fmt(stripePlan.prices.semiannual.amount)}</span>
                    </div>
                  )}
                  {stripePlan?.prices.annual && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Anual</span>
                      <span className="text-foreground">{fmt(stripePlan.prices.annual.amount)}</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground/60 font-mono">ID: {plan.product_id}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
