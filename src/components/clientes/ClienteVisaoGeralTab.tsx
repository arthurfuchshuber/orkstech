import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Plus, Loader2, Trash2, Paperclip, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TextInput } from "@/components/inputs/TextInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cliente: Tables<"clientes">;
  onEdit: () => void;
}

const tipoLabels: Record<string, string> = {
  atualizacao_cadastral: "Atualização",
  documento_anexado: "Documento",
  interacao: "Nota",
  evento_financeiro: "Financeiro",
  observacao: "Observação",
  contrato: "Contrato",
};

const tipoColors: Record<string, string> = {
  atualizacao_cadastral: "text-blue-400",
  documento_anexado: "text-violet-400",
  interacao: "text-rose-400",
  evento_financeiro: "text-emerald-400",
  observacao: "text-amber-400",
  contrato: "text-rose-400",
};

export function ClienteVisaoGeralTab({ cliente, onEdit: _onEdit }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("interacao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState("");
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const { data: interacoes = [], isLoading } = useQuery({
    queryKey: ["cliente-interacoes", cliente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_interacoes")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cliente_interacoes").insert({
        user_id: user!.id,
        cliente_id: cliente.id,
        tipo,
        descricao: `${titulo ? titulo + ". " : ""}${descricao}`,
        usuario_nome: user?.email || "Usuário",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [["cliente-interacoes", cliente.id]]);
      toast.success("Atividade registrada");
      setTitulo("");
      setDescricao("");
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, tipo, descricao }: { id: string; tipo: string; descricao: string }) => {
      const { error } = await supabase
        .from("cliente_interacoes")
        .update({ tipo, descricao })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [["cliente-interacoes", cliente.id]]);
      toast.success("Atividade atualizada");
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cliente_interacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [["cliente-interacoes", cliente.id]]);
      toast.success("Atividade excluída");
      setDeleteId(null);
    },
  });

  const startEdit = (item: any) => {
    const { title, body } = parseInteracao(item.descricao);
    setEditingId(item.id);
    setEditTipo(item.tipo);
    setEditTitulo(title);
    setEditDescricao(body);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const fullDesc = `${editTitulo ? editTitulo + ". " : ""}${editDescricao}`;
    updateMutation.mutate({ id: editingId, tipo: editTipo, descricao: fullDesc });
  };

  // Smart summary
  const summaryText = interacoes.length === 0
    ? "Nenhum dado suficiente ainda."
    : `${interacoes.length} interações registradas. Última atividade ${formatDistanceToNow(new Date(interacoes[0].created_at), { locale: ptBR, addSuffix: true })}.`;

  // Generate AI-like insight for each interaction
  const getInsight = (item: any) => {
    const desc = (item.descricao || "").toLowerCase();
    if (desc.includes("insatisfa")) return "Cliente expressou insatisfação com o produto adquirido.";
    if (desc.includes("contrato") || item.tipo === "contrato") return "Novo contrato de parceria estabelecido.";
    if (desc.includes("pagamento") || item.tipo === "evento_financeiro") return "Evento financeiro registrado no histórico.";
    if (desc.includes("documento") || item.tipo === "documento_anexado") return "Documento vinculado ao perfil do cliente.";
    if (desc.includes("atualiza") || item.tipo === "atualizacao_cadastral") return "Dados cadastrais foram atualizados.";
    return null;
  };

  // Parse title and description from stored descricao
  const parseInteracao = (descricao: string) => {
    const dotIndex = descricao.indexOf(". ");
    if (dotIndex > 0 && dotIndex < 60) {
      return { title: descricao.substring(0, dotIndex), body: descricao.substring(dotIndex + 2) };
    }
    return { title: descricao, body: "" };
  };

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <Card className="p-5 border-primary/20 bg-primary/[0.03] shadow-sm">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">Resumo IA</p>
            <p className="text-sm text-muted-foreground mt-0.5">{summaryText}</p>
          </div>
        </div>
      </Card>

      {/* Timeline header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Linha do Tempo</h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 rounded-lg"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4" /> Adicionar Atividade
        </Button>
      </div>

      {/* New activity form */}
      {showForm && (
        <Card className="p-5 border-border/50 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Insatisfação"
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
            <Textarea
              placeholder="Descreva a atividade..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => createMutation.mutate()}
              disabled={!descricao.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Salvar
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : interacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border/40" />

          {interacoes.map((item) => {
            const { title, body } = parseInteracao(item.descricao);
            const insight = getInsight(item);
            const colorClass = tipoColors[item.tipo] || "text-rose-400";
            const hasAttachment = item.tipo === "contrato" || item.tipo === "documento_anexado";

            return (
              <div key={item.id} className="relative pb-6 last:pb-0 group">
                {/* Timeline dot */}
                <div className="absolute -left-[13px] top-3 w-3 h-3 rounded-full border-2 border-border bg-card" />

                <Card className="ml-4 p-5 border-border/40 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${colorClass}`}>📌</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{title}</span>
                          {hasAttachment && <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tipoLabels[item.tipo] || item.tipo}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {body && (
                    <p className="text-sm text-muted-foreground mt-2">{body}</p>
                  )}

                  {/* AI insight */}
                  {insight && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/10">
                      <p className="text-xs text-primary flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />
                        {insight}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground/60 mt-3">
                    {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {item.usuario_nome && ` por ${item.usuario_nome}`}
                  </p>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Título"
                value={editTitulo}
                onChange={(e) => setEditTitulo(e.target.value)}
                placeholder="Ex: Insatisfação"
              />
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
                <Select value={editTipo} onValueChange={setEditTipo}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
              <Textarea
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                className="min-h-[100px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={saveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
            return (
              <div key={item.id} className="relative pb-6 last:pb-0 group">
                {/* Timeline dot */}
                <div className="absolute -left-[13px] top-3 w-3 h-3 rounded-full border-2 border-border bg-card" />

                <Card className="ml-4 p-5 border-border/40 shadow-sm hover:border-border/60 transition-colors">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <TextInput
                          label="Título"
                          value={editTitulo}
                          onChange={(e) => setEditTitulo(e.target.value)}
                          placeholder="Ex: Insatisfação"
                        />
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
                          <Select value={editTipo} onValueChange={setEditTipo}>
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(tipoLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
                        <Textarea
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          className="min-h-[80px] text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={saveEdit}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${colorClass}`}>📌</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{title}</span>
                              {hasAttachment && <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {tipoLabels[item.tipo] || item.tipo}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {body && (
                        <p className="text-sm text-muted-foreground mt-2">{body}</p>
                      )}

                      {/* AI insight */}
                      {insight && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/10">
                          <p className="text-xs text-primary flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            {insight}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground/60 mt-3">
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {item.usuario_nome && ` por ${item.usuario_nome}`}
                      </p>
                    </>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}