import { FileSearch, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContractItem {
  id: string;
  descricao: string;
  valor: string;
  dataInicio: string;
  dataTermino?: string;
  status: "ativo" | "encerrado" | "cancelado" | "pendente";
}

interface RelatedContractsProps {
  contracts?: ContractItem[];
}

const statusStyles = {
  ativo: "bg-success/10 text-success",
  encerrado: "bg-muted/30 text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
  pendente: "bg-warning/10 text-warning",
};

export function RelatedContracts({ contracts = [] }: RelatedContractsProps) {
  if (contracts.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <FileSearch className="w-5 h-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Nenhum contrato vinculado</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Contratos relacionados aparecerão aqui</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-lg gap-1.5">
          <FileSearch className="w-3 h-3" /> Novo contrato
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map((c) => (
        <Card key={c.id} className="p-3 border-border/40 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSearch className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{c.descricao}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{c.dataInicio}{c.dataTermino ? ` — ${c.dataTermino}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{c.valor}</span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", statusStyles[c.status])}>
              {c.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
