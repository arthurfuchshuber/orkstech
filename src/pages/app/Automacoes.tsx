import { useState } from "react";
import { Workflow, Zap, CheckCircle, Plus, Trash2, ListChecks } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { useAutomacoes } from "@/hooks/useAutomacoes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const eventLabels: Record<string, string> = {
  "cliente.criado": "Cliente criado",
  "cliente.atualizado": "Cliente atualizado",
  "contrato.criado": "Contrato criado",
  "contrato.renovado": "Contrato renovado",
  "contrato.vencendo": "Contrato próximo do vencimento",
  "financeiro.cobranca_criada": "Cobrança criada",
  "financeiro.pagamento_recebido": "Pagamento recebido",
  "financeiro.cobranca_vencida": "Cobrança vencida",
  "documento.anexado": "Documento anexado",
  "atividade.criada": "Atividade registrada",
  "fornecedor.criado": "Fornecedor criado",
};

const actionLabels: Record<string, string> = {
  criar_historico: "Registrar no histórico",
  criar_atividade: "Criar atividade",
  criar_notificacao: "Enviar notificação",
  criar_financeiro: "Gerar financeiro",
  atualizar_status: "Atualizar status",
};

export default function Automacoes() {
  const { automacoes, isLoading, add, toggle, remove, isAdding } = useAutomacoes();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    eventoGatilho: "",
    acaoTipo: "criar_notificacao",
  });

  const activeCount = automacoes.filter((a) => a.ativo).length;
  const totalExec = automacoes.reduce((s, a) => s + a.executado_count, 0);

  const handleSave = async () => {
    if (!form.nome || !form.eventoGatilho) {
      toast.error("Preencha nome e evento gatilho");
      return;
    }
    try {
      await add({
        nome: form.nome,
        descricao: form.descricao,
        ativo: true,
        evento_gatilho: form.eventoGatilho,
        condicoes: [],
        acoes: [{ tipo: form.acaoTipo, config: { titulo: form.nome, descricao: form.descricao } }],
      });
      toast.success("Automação criada!");
      setShowForm(false);
      setForm({ nome: "", descricao: "", eventoGatilho: "", acaoTipo: "criar_notificacao" });
    } catch {
      toast.error("Erro ao criar automação");
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

  const handleToggle = async (id: string, currentAtivo: boolean) => {
    try {
      await toggle(id, currentAtivo);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Regras de Automação</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas automações e eventos do sistema</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Nova Automação
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ListChecks} title="Total de Regras" value={String(automacoes.length)} />
        <StatCard icon={Workflow} title="Regras Ativas" value={String(activeCount)} />
        <StatCard icon={CheckCircle} title="Execuções Totais" value={String(totalExec)} />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : automacoes.length === 0 ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma automação cadastrada.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="rounded-lg gap-2">
                <Plus className="w-3.5 h-3.5" /> Criar primeira automação
              </Button>
            </CardContent>
          </Card>
        ) : (
          automacoes.map((auto) => (
            <Card key={auto.id} className="border-border/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      auto.ativo ? "bg-primary/10" : "bg-muted/30"
                    }`}
                  >
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
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Gatilho</p>
                      <p className="text-xs font-medium text-foreground">
                        {eventLabels[auto.evento_gatilho] || auto.evento_gatilho}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Execuções</p>
                      <p className="text-sm font-semibold text-foreground">{auto.executado_count}</p>
                    </div>
                    <Switch checked={auto.ativo} onCheckedChange={() => handleToggle(auto.id, auto.ativo)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(auto.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Ações:</span>
                  {(auto.acoes as { tipo: string }[]).map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-border/40 text-muted-foreground">
                      {actionLabels[a.tipo] || a.tipo}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create form */}
      <FormModal open={showForm} onOpenChange={setShowForm} title="Nova Automação" description="Configure evento gatilho e ações automáticas" size="lg">
        <div className="space-y-5">
          <TextInput label="Nome" placeholder="Ex: Boas-vindas ao cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <TextInput label="Descrição" placeholder="O que essa automação faz..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Evento Gatilho</label>
              <Select value={form.eventoGatilho} onValueChange={(v) => setForm({ ...form, eventoGatilho: v })}>
                <SelectTrigger className="rounded-lg h-10">
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ação</label>
              <Select value={form.acaoTipo} onValueChange={(v) => setForm({ ...form, acaoTipo: v })}>
                <SelectTrigger className="rounded-lg h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isAdding} className="rounded-lg gap-2 shadow-sm">
              <CheckCircle className="w-4 h-4" /> Criar Automação
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
