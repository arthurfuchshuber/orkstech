import { DollarSign, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FinancialItem {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: string;
  vencimento: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  origem?: string;
}

interface RelatedFinancialProps {
  items?: FinancialItem[];
}

const statusStyles = {
  pendente: "bg-warning/10 text-warning",
  pago: "bg-success/10 text-success",
  atrasado: "bg-destructive/10 text-destructive",
  cancelado: "bg-muted/30 text-muted-foreground",
};

const statusLabels = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export function RelatedFinancial({ items = [] }: RelatedFinancialProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <DollarSign className="w-5 h-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Nenhum registro financeiro</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Contas a pagar e receber aparecerão aqui</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-lg gap-1.5">
          <DollarSign className="w-3 h-3" /> Novo lançamento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className="p-3 border-border/40 flex items-center justify-between hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              item.tipo === "receber" ? "bg-success/10" : "bg-destructive/10"
            )}>
              {item.tipo === "receber"
                ? <ArrowDownRight className="w-3.5 h-3.5 text-success" />
                : <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
              }
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{item.descricao}</p>
              {item.origem && <p className="text-xs text-muted-foreground">Origem: {item.origem}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-foreground">{item.valor}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />{item.vencimento}
            </span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", statusStyles[item.status])}>
              {statusLabels[item.status]}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
