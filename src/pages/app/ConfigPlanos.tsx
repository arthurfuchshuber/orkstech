import { CreditCard, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "Grátis",
    current: true,
    features: [
      "1 usuário",
      "1 empresa",
      "Módulos básicos",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Profissional",
    price: "R$ 99/mês",
    current: false,
    features: [
      "Até 5 usuários",
      "1 empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "Suporte prioritário",
    ],
  },
  {
    name: "Empresarial",
    price: "R$ 249/mês",
    current: false,
    features: [
      "Usuários ilimitados",
      "Multi-empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "API & Webhooks",
      "Suporte dedicado",
    ],
  },
];

export default function ConfigPlanos() {
  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Planos e Assinatura</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie seu plano atual e veja as opções disponíveis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`p-5 flex flex-col justify-between ${
              plan.current ? "border-primary/40 ring-1 ring-primary/20" : ""
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                {plan.current && <Badge className="text-[10px]">Atual</Badge>}
              </div>
              <p className="text-2xl font-bold text-foreground mb-4">{plan.price}</p>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5">
              {plan.current ? (
                <Button variant="outline" size="sm" className="w-full" disabled>
                  Plano atual
                </Button>
              ) : (
                <Button size="sm" className="w-full">
                  Fazer upgrade
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          O gerenciamento de pagamentos, faturas e métodos de cobrança estará disponível em breve.
        </p>
      </Card>
    </div>
  );
}
