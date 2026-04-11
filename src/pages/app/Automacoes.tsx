import { useState } from "react";
import { Workflow, Zap, Clock, CheckCircle, Plus, Play, Pause, Settings, ChevronRight, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { useAutomations } from "@/hooks/useEventBus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventType, AutomationAction } from "@/lib/events";
import { toast } from "sonner";

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
  const { automations, toggle, add } = useAutomations();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    eventoGatilho: "" as EventType | "",
    acaoTipo: "criar_notificacao" as AutomationAction["tipo"],
  });

  const activeCount = automations.filter(a => a.ativo).length;
  const totalExec = automations.reduce((s, a) => s + a.executadoCount, 0);

  const handleSave = () => {
    if (!form.nome || !form.eventoGatilho) {
      toast.error("Preencha nome e evento gatilho");
      return;
    }
    add({
      nome: form.nome,
      descricao: form.descricao,
      ativo: true,
      eventoGatilho: form.eventoGatilho as EventType,
      condicoes: [],
      acoes: [{ tipo: form.acaoTipo, config: { titulo: form.nome, descricao: form.descricao } }],
    });
    toast.success("Automação criada!");
    setShowForm(false);
    setForm({ nome: "", descricao: "", eventoGatilho: "", acaoTipo: "criar_notificacao" });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Automações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Workflows e eventos inteligentes do sistema</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Nova Automação
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Workflow} title="Automações Ativas" value={String(activeCount)} />
        <StatCard icon={CheckCircle} title="Execuções Totais" value={String(totalExec)} />
        <StatCard icon={Zap} title="Eventos Disponíveis" value={String(Object.keys(eventLabels).length)} />
      </div>

      <div className="space-y-3">
        {automations.map((auto) => (
          <Card key={auto.id} className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  auto.ativo ? "bg-primary/10" : "bg-muted/30"
                }`}>
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
                    <p className="text-xs font-medium text-foreground">{eventLabels[auto.eventoGatilho] || auto.eventoGatilho}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Execuções</p>
                    <p className="text-sm font-semibold text-foreground">{auto.executadoCount}</p>
                  </div>
                  <Switch checked={auto.ativo} onCheckedChange={() => toggle(auto.id)} />
                </div>
              </div>
              <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Ações:</span>
                {auto.acoes.map((a, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-border/40 text-muted-foreground">
                    {actionLabels[a.tipo] || a.tipo}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Event flow visualization */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Fluxo de Eventos</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Eventos</p>
              {Object.entries(eventLabels).slice(0, 5).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                <ArrowRight className="w-6 h-6" />
                <span className="text-[10px] uppercase tracking-wider">Automação</span>
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">Ações</p>
              {Object.entries(actionLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-success/60" />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <FormModal open={showForm} onOpenChange={setShowForm} title="Nova Automação" description="Configure evento gatilho e ações automáticas" size="lg">
        <div className="space-y-5">
          <TextInput label="Nome" placeholder="Ex: Boas-vindas ao cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <TextInput label="Descrição" placeholder="O que essa automação faz..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Evento Gatilho</label>
              <Select value={form.eventoGatilho} onValueChange={(v) => setForm({ ...form, eventoGatilho: v as EventType })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(eventLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ação</label>
              <Select value={form.acaoTipo} onValueChange={(v) => setForm({ ...form, acaoTipo: v as AutomationAction["tipo"] })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSave} className="rounded-lg gap-2 shadow-sm"><CheckCircle className="w-4 h-4" /> Criar Automação</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
