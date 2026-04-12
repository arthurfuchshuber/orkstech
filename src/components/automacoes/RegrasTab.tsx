import { useState } from "react";
import { Workflow, Zap, CheckCircle, Plus, Trash2, ListChecks, Pencil } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { useAutomacoes, useGatilhos, useAcoesTipo } from "@/hooks/useAutomacoes";
import type { AutomacaoDB } from "@/hooks/useAutomacoes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RegrasTab() {
  const { automacoes, isLoading, add, update, toggle, remove, isAdding } = useAutomacoes();
  const { gatilhos } = useGatilhos();
  const { acoes: acoesTipo } = useAcoesTipo();

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomacaoDB | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", eventoGatilho: "", acaoTipo: "" });

  const activeCount = automacoes.filter((a) => a.ativo).length;
  const totalExec = automacoes.reduce((s, a) => s + a.executado_count, 0);

  // Build label maps from DB
  const gatilhoMap = Object.fromEntries(gatilhos.map((g) => [g.nome, g.label]));
  const acaoMap = Object.fromEntries(acoesTipo.map((a) => [a.nome, a.label]));
  const activeGatilhos = gatilhos.filter((g) => g.ativo);
  const activeAcoes = acoesTipo.filter((a) => a.ativo);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ nome: "", descricao: "", eventoGatilho: "", acaoTipo: activeAcoes[0]?.nome || "" });
    setShowForm(true);
  };

  const openEdit = (auto: AutomacaoDB) => {
    setEditingRule(auto);
    const firstAcao = (auto.acoes as { tipo: string }[])[0]?.tipo || "";
    setForm({ nome: auto.nome, descricao: auto.descricao, eventoGatilho: auto.evento_gatilho, acaoTipo: firstAcao });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.eventoGatilho) {
      toast.error("Preencha nome e evento gatilho");
      return;
    }
    if (!form.acaoTipo) {
      toast.error("Selecione uma ação");
      return;
    }
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao,
        evento_gatilho: form.eventoGatilho,
        ativo: true,
        condicoes: [],
        acoes: [{ tipo: form.acaoTipo, config: { titulo: form.nome, descricao: form.descricao } }],
      };
      if (editingRule) {
        await update({ id: editingRule.id, ...payload });
        toast.success("Automação atualizada!");
      } else {
        await add(payload);
        toast.success("Automação criada!");
      }
      setShowForm(false);
      setEditingRule(null);
    } catch {
      toast.error("Erro ao salvar automação");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      toast.success("Automação excluída");
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Regras de Automação</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Crie e gerencie regras que disparam ações automaticamente</p>
        </div>
        <Button onClick={openCreate} className="rounded-lg gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ListChecks} title="Total de Regras" value={String(automacoes.length)} />
        <StatCard icon={Workflow} title="Regras Ativas" value={String(activeCount)} />
        <StatCard icon={CheckCircle} title="Execuções Totais" value={String(totalExec)} />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : automacoes.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
              <Button variant="outline" size="sm" onClick={openCreate} className="rounded-lg gap-2">
                <Plus className="w-3.5 h-3.5" /> Criar primeira regra
              </Button>
            </CardContent>
          </Card>
        ) : (
          automacoes.map((auto) => (
            <Card key={auto.id} className="border-border/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${auto.ativo ? "bg-primary/10" : "bg-muted/30"}`}>
                    <Zap className={`w-4 h-4 ${auto.ativo ? "text-primary" : "text-muted-foreground/40"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{auto.nome}</h3>
                      <Badge variant={auto.ativo ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {auto.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{auto.descricao}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Gatilho</p>
                      <p className="text-xs font-medium text-foreground">{gatilhoMap[auto.evento_gatilho] || auto.evento_gatilho}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Execuções</p>
                      <p className="text-sm font-semibold text-foreground">{auto.executado_count}</p>
                    </div>
                    <Switch checked={auto.ativo} onCheckedChange={() => toggle(auto.id, auto.ativo)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(auto)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(auto.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Ações:</span>
                  {(auto.acoes as { tipo: string }[]).map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-border/40 text-muted-foreground">
                      {acaoMap[a.tipo] || a.tipo}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormModal open={showForm} onOpenChange={setShowForm} title={editingRule ? "Editar Regra" : "Nova Regra"} description="Configure gatilho e ação automática" size="lg">
        <div className="space-y-5">
          <TextInput label="Nome" placeholder="Ex: Boas-vindas ao cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <TextInput label="Descrição" placeholder="O que essa regra faz..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Evento Gatilho</label>
              <Select value={form.eventoGatilho} onValueChange={(v) => setForm({ ...form, eventoGatilho: v })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Selecione o gatilho" /></SelectTrigger>
                <SelectContent>
                  {activeGatilhos.map((g) => (
                    <SelectItem key={g.nome} value={g.nome}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ação</label>
              <Select value={form.acaoTipo} onValueChange={(v) => setForm({ ...form, acaoTipo: v })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Selecione a ação" /></SelectTrigger>
                <SelectContent>
                  {activeAcoes.map((a) => (
                    <SelectItem key={a.nome} value={a.nome}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingRule(null); }} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSave} disabled={isAdding} className="rounded-lg gap-2 shadow-sm">
              <CheckCircle className="w-4 h-4" /> {editingRule ? "Salvar" : "Criar Regra"}
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
