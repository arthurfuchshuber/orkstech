import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Database, Trash2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerLabel: string;
  /** Texto descrevendo os dados que serão preservados/excluídos. */
  dataDescription: string;
  /** Remove só a credencial/conexão, preservando dados sincronizados. */
  onKeepData: () => Promise<void> | void;
  /** Remove credencial + apaga TODOS os dados sincronizados. */
  onPurgeData: () => Promise<void> | void;
}

export function RemoveIntegrationDialog({
  open, onOpenChange, providerLabel, dataDescription, onKeepData, onPurgeData,
}: Props) {
  const [busy, setBusy] = useState<"keep" | "purge" | null>(null);

  const run = async (mode: "keep" | "purge") => {
    setBusy(mode);
    try {
      if (mode === "keep") await onKeepData();
      else await onPurgeData();
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {providerLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            A conexão será desfeita. Escolha o que fazer com os dados já sincronizados:
            <br /><br />
            <span className="text-foreground">{dataDescription}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 pt-1">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("keep")}
            className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              {busy === "keep" ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Database className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Manter dados sincronizados</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Recomendado. Remove apenas a credencial; lançamentos e histórico permanecem.</p>
            </div>
          </button>

          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("purge")}
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-md bg-destructive/15 flex items-center justify-center shrink-0">
              {busy === "purge" ? <Loader2 className="w-4 h-4 animate-spin text-destructive" /> : <Trash2 className="w-4 h-4 text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Excluir tudo</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Remove credencial e apaga permanentemente os dados importados desta integração.</p>
            </div>
          </button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
