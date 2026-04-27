import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SocioModal } from "./SocioModal";

function formatCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatPhone(p?: string | null) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return p;
}

export function SociosSection() {
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: socios = [], isLoading } = useQuery({
    queryKey: ["empresa_socios", empresa?.id],
    queryFn: async () => {
      if (!empresa?.id) return [];
      const { data, error } = await supabase
        .from("empresa_socios")
        .select("*")
        .eq("empresa_id", empresa.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresa?.id,
  });

  const totalParticipacao = socios.reduce(
    (acc: number, s: any) => acc + (Number(s.percentual_participacao) || 0),
    0
  );

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("empresa_socios").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir sócio"); return; }
    toast.success("Sócio removido");
    await queryClient.invalidateQueries({ queryKey: ["empresa_socios"] });
    setDeleteId(null);
  };

  if (!empresa) return null;

  return (
    <>
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold">Quadro Societário</h3>
              <p className="text-xs text-muted-foreground">
                Sócios cadastrados na empresa — usados para vincular pagamentos (pró-labore, distribuição, reembolsos).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {socios.length > 0 && (
              <Badge variant={Math.abs(totalParticipacao - 100) < 0.01 ? "default" : "outline"}>
                Total: {totalParticipacao.toFixed(2)}%
              </Badge>
            )}
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Sócio
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando sócios...</p>
        ) : socios.length === 0 ? (
          <div className="py-10 text-center border border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Adicione o primeiro sócio do quadro societário.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {socios.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {s.nome_completo?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{s.nome_completo}</p>
                    {s.administrador && (
                      <Badge variant="secondary" className="gap-1 h-5 text-[10px]">
                        <Crown className="h-3 w-3" /> Administrador
                      </Badge>
                    )}
                    {!s.ativo && <Badge variant="outline" className="h-5 text-[10px]">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.cargo || "Sócio"} • CPF {formatCpf(s.cpf)} • {formatPhone(s.telefone)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">
                    {Number(s.percentual_participacao ?? 0).toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">participação</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SocioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        socioId={editingId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Lançamentos financeiros vinculados ao sócio terão o vínculo removido, mas não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
