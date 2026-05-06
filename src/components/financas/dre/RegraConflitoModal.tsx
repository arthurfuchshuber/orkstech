import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, PowerOff, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNavigate } from "react-router-dom";
import type { RegraConflito } from "@/hooks/useRegraConflitoDetector";

interface Props {
  conflito: RegraConflito | null;
  onClose: () => void;
}

/**
 * Modal de conflito de regra DRE — abre por cima de qualquer outro modal.
 * Permite Inativar / Visualizar / Editar a regra que está "lutando" contra
 * as alterações manuais recentes do usuário.
 */
export function RegraConflitoModal({ conflito, onClose }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const open = !!conflito;

  const { data: cats = [] } = useQuery({
    queryKey: ["regra-conflito-cats", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("user_id", targetUserId!);
      return data ?? [];
    },
  });

  const inativar = useMutation({
    mutationFn: async () => {
      if (!conflito) return;
      const { error } = await supabase
        .from("dre_regras" as any)
        .update({ ativo: false })
        .eq("id", conflito.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dre-regras"] });
      toast.success("Regra inativada");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao inativar"),
  });

  if (!conflito) return null;

  const catAtual = cats.find((c: any) => c.id === conflito.categoriaAtualId)?.nome || "—";
  const catNova = cats.find((c: any) => c.id === conflito.categoriaNovaId)?.nome || "Sem categoria";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg z-[60]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-warning/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>
            Conflito com regra automática
          </DialogTitle>
          <DialogDescription>
            Detectamos que você reclassificou várias movimentações com a descrição{" "}
            <Badge variant="outline" className="font-mono text-[11px] mx-1">{conflito.termo}</Badge>
            mas existe uma regra ativa que continuará re-categorizando essas transações.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Regra</span>
            <span className="font-medium truncate ml-3" title={conflito.nome}>{conflito.nome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Aplica</span>
            <span className="text-xs">{catAtual}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Você está usando</span>
            <span className="text-xs text-primary">{catNova}</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Manter regra</Button>
          <Button
            variant="outline"
            onClick={() => { navigate("/app/dre"); onClose(); }}
          >
            <Eye className="w-4 h-4 mr-1" /> Visualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => { navigate(`/app/dre?editRegra=${conflito.id}`); onClose(); }}
          >
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button
            variant="destructive"
            onClick={() => inativar.mutate()}
            disabled={inativar.isPending}
          >
            {inativar.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PowerOff className="w-4 h-4 mr-1" />}
            Inativar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
