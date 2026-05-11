import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalIn: number;
  totalOut: number;
  /** Categorizar somente os de entrada, ignorando saídas */
  onApplyIncome: () => void;
  /** Categorizar somente os de saída, ignorando entradas */
  onApplyExpense: () => void;
}

/**
 * Modal exibido quando o usuário tenta categorizar em massa uma seleção
 * que contém entradas E saídas ao mesmo tempo.
 * Oferece resolução automática agrupando por tipo.
 */
export function MixedTypeBulkDialog({ open, onOpenChange, totalIn, totalOut, onApplyIncome, onApplyExpense }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Seleção contém entradas e saídas
          </DialogTitle>
          <DialogDescription className="pt-1.5 text-sm leading-relaxed">
            Cada categoria do DRE pertence a um único lado (entrada ou saída).
            Por isso não é possível aplicar a mesma categoria a movimentações de tipos diferentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          <div className="rounded-md border border-success/30 bg-success/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-success/80">
              <ArrowDownLeft className="h-3 w-3" /> Entradas
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-success">{totalIn}</p>
          </div>
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-warning/80">
              <ArrowUpRight className="h-3 w-3" /> Saídas
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-warning">{totalOut}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="outline"
            disabled={totalOut === 0}
            onClick={() => { onApplyExpense(); onOpenChange(false); }}
            className="border-warning/40 text-warning hover:bg-warning/10"
          >
            Categorizar só saídas ({totalOut})
          </Button>
          <Button
            disabled={totalIn === 0}
            onClick={() => { onApplyIncome(); onOpenChange(false); }}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            Categorizar só entradas ({totalIn})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
