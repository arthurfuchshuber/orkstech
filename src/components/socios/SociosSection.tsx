import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Crown, RefreshCw, Loader2, ShieldCheck, Building2 } from "lucide-react";
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
import { QSAImportModal } from "./QSAImportModal";

function formatDoc(doc?: string | null, tipo?: string | null) {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if ((tipo === "PJ" || d.length === 14) && d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 6) return `***.${d.slice(0, 3)}.${d.slice(3)}-**`;
  return doc;
}

function isDocPartial(doc?: string | null, tipo?: string | null): boolean {
  if (!doc) return false;
  const d = doc.replace(/\D/g, "");
  if (tipo === "PJ") return d.length !== 14;
  return d.length > 0 && d.length !== 11;
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
  const [qsaModalOpen, setQsaModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const sociosAtivos = socios.filter((s: any) => s.status_socio !== "inativo" && s.ativo !== false);
  const totalParticipacao = sociosAtivos.reduce(
    (acc: number, s: any) => acc + (Number(s.percentual_participacao) || 0),
    0
  );

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalOpen(true); };

  const handleSyncReceita = async () => {
    if (!empresa?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-qsa-empresas", {
        body: { empresa_id: empresa.id },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.skipped) {
        toast.error("Não foi possível sincronizar com a Receita Federal");
      } else {
        toast.success("Quadro Societário sincronizado", {
          description: `${r?.created || 0} novo(s), ${r?.updated || 0} atualizado(s), ${r?.deactivated || 0} inativado(s).`,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["empresa_socios"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            {sociosAtivos.length > 0 && (
              <Badge variant={Math.abs(totalParticipacao - 100) < 0.01 ? "default" : "outline"}>
                Total: {totalParticipacao.toFixed(2)}%
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => setQsaModalOpen(true)} className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Importar da Receita
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSyncReceita} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar
            </Button>
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
                  {s.tipo_pessoa === "PJ" ? (
                    <Building2 className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="text-sm font-semibold text-primary">
                      {s.nome_completo?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{s.nome_completo}</p>
                    {s.tipo_pessoa === "PJ" && (
                      <Badge variant="outline" className="h-5 text-[10px]">PJ</Badge>
                    )}
                    {s.origem === "receita_federal" && (
                      <Badge variant="outline" className="gap-1 h-5 text-[10px] border-primary/30 text-primary bg-primary/5">
                        <ShieldCheck className="h-3 w-3" /> Receita
                      </Badge>
                    )}
                    {s.administrador && (
                      <Badge variant="secondary" className="gap-1 h-5 text-[10px]">
                        <Crown className="h-3 w-3" /> Administrador
                      </Badge>
                    )}
                    {(s.status_socio === "inativo" || s.ativo === false) && (
                      <Badge variant="outline" className="h-5 text-[10px]">Inativo</Badge>
                    )}
                    {isDocPartial(s.documento || s.cpf, s.tipo_pessoa) && (
                      <Badge variant="outline" className="h-5 text-[10px] border-amber-500/40 text-amber-500 bg-amber-500/5">
                        {s.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} pendente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.cargo || s.qualificacao || "Sócio"} • {s.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} {formatDoc(s.documento || s.cpf, s.tipo_pessoa)} • {formatPhone(s.telefone)}
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

      <QSAImportModal
        open={qsaModalOpen}
        onOpenChange={setQsaModalOpen}
        empresaId={empresa.id}
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
