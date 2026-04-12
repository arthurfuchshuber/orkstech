import { useState } from "react";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { useAcoesTipo } from "@/hooks/useAutomacoes";
import type { AcaoTipoDB } from "@/hooks/useAutomacoes";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AcoesTab() {
  const { acoes, isLoading, add, update, remove } = useAcoesTipo();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AcaoTipoDB | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", label: "", descricao: "" });

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", label: "", descricao: "" });
    setShowForm(true);
  };

  const openEdit = (a: AcaoTipoDB) => {
    setEditing(a);
    setForm({ nome: a.nome, label: a.label, descricao: a.descricao });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.label) {
      toast.error("Preencha o identificador e o nome");
      return;
    }
    try {
      if (editing) {
        await update({ id: editing.id, nome: form.nome, label: form.label, descricao: form.descricao });
        toast.success("Ação atualizada!");
      } else {
        await add(form);
        toast.success("Ação criada!");
      }
      setShowForm(false);
      setEditing(null);
    } catch {
      toast.error("Erro ao salvar ação");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      toast.success("Ação excluída");
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (a: AcaoTipoDB) => {
    try {
      await update({ id: a.id, ativo: !a.ativo });
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ações</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Tipos de ação que podem ser executadas pelas automações</p>
        </div>
        <Button onClick={openCreate} className="rounded-lg gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nova Ação
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : acoes.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma ação cadastrada. As ações padrão serão criadas automaticamente.
            </CardContent>
          </Card>
        ) : (
          acoes.map((a) => (
            <Card key={a.id} className="border-border/50 shadow-sm">
              <CardContent className="p-3 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.ativo ? "bg-success/10" : "bg-muted/30"}`}>
                  <Play className={`w-3.5 h-3.5 ${a.ativo ? "text-success" : "text-muted-foreground/40"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">{a.label}</h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground font-mono">
                      {a.nome}
                    </Badge>
                  </div>
                  {a.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.descricao}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={a.ativo} onCheckedChange={() => handleToggle(a)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(a)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ação?</AlertDialogTitle>
            <AlertDialogDescription>Automações que usam esta ação deixarão de executá-la.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormModal open={showForm} onOpenChange={setShowForm} title={editing ? "Editar Ação" : "Nova Ação"} description="Defina o tipo de ação executada pelas automações" size="md">
        <div className="space-y-4">
          <TextInput label="Nome amigável" placeholder="Ex: Enviar e-mail" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <TextInput
            label="Identificador técnico"
            placeholder="Ex: enviar_email"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
          />
          <TextareaInput label="Descrição" placeholder="O que essa ação faz..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSave} className="rounded-lg gap-2 shadow-sm">{editing ? "Salvar" : "Criar Ação"}</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
