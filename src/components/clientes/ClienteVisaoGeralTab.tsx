import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Plus, Loader2, Trash2, Paperclip, Pencil,
  AlertTriangle, TrendingUp, TrendingDown, Calendar, CheckCircle2, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TextInput } from "@/components/inputs/TextInput";
import { ManagedSelectInput, type ManagedOption } from "@/components/inputs/ManagedSelectInput";
import { MultiFileAttachment, type UploadedFile } from "@/components/inputs/MultiFileAttachment";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

const tipoColors: Record<string, string> = {
  "Atualização": "text-blue-400",
  "Documento": "text-violet-400",
  "Nota": "text-rose-400",
  "Financeiro": "text-emerald-400",
  "Observação": "text-amber-400",
  "Contrato": "text-rose-400",
};

const defaultTipos = [
  { nome: "Atualização", ordem: 0 },
  { nome: "Documento", ordem: 1 },
  { nome: "Nota", ordem: 2 },
  { nome: "Financeiro", ordem: 3 },
  { nome: "Observação", ordem: 4 },
  { nome: "Contrato", ordem: 5 },
];

const parseInteracao = (descricao: string) => {
  const dotIndex = descricao.indexOf(". ");
  if (dotIndex > 0 && dotIndex < 60) {
    return { title: descricao.substring(0, dotIndex), body: descricao.substring(dotIndex + 2) };
  }
  return { title: descricao, body: "" };
};

export function ClienteVisaoGeralTab({ cliente, onEdit: _onEdit }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTipoId, setEditTipoId] = useState("");
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editFiles, setEditFiles] = useState<UploadedFile[]>([]);

  // Fetch tipos from DB
  const { data: tipos = [], isLoading: tiposLoading } = useQuery({
    queryKey: ["cliente-interacao-tipos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_interacao_tipos" as any)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Seed default types if none exist
  useEffect(() => {
    if (!tiposLoading && tipos.length === 0 && user) {
      const seedDefaults = async () => {
        const records = defaultTipos.map((t) => ({ ...t, user_id: user.id }));
        await supabase.from("cliente_interacao_tipos" as any).insert(records);
        queryClient.invalidateQueries({ queryKey: ["cliente-interacao-tipos"] });
      };
      seedDefaults();
    }
  }, [tiposLoading, tipos.length, user, queryClient]);

  const tipoOptions: ManagedOption[] = tipos
    .filter((t: any) => t.ativo)
    .map((t: any) => ({ value: t.id, label: t.nome }));

  const managed = useManagedSelect("cliente_interacao_tipos");

  const getTipoLabel = (tipoValue: string) => {
    const byId = tipos.find((t: any) => t.id === tipoValue);
    if (byId) return byId.nome;
    return tipoValue;
  };

  // Fetch interações with linked documents
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

  // Realtime: refresh timeline whenever any module writes to cliente_interacoes / cliente_documentos for this client
  useEffect(() => {
    const channel = supabase
      .channel(`cliente-workspace-${cliente.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_interacoes", filter: `cliente_id=eq.${cliente.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cliente-interacoes", cliente.id] });
          queryClient.invalidateQueries({ queryKey: ["cliente-fin-snapshot", cliente.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_documentos", filter: `cliente_id=eq.${cliente.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cliente-documentos", cliente.id] });
          queryClient.invalidateQueries({ queryKey: ["cliente-interacao-docs", cliente.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cliente.id, queryClient]);

  // Fetch docs linked to interações for display
  const interacaoIds = interacoes.map((i) => i.id);
  const { data: interacaoDocs = [] } = useQuery({
    queryKey: ["cliente-interacao-docs", cliente.id, interacaoIds],
    queryFn: async () => {
      if (interacaoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("cliente_documentos")
        .select("*")
        .in("interacao_id", interacaoIds);
      if (error) throw error;
      return data;
    },
    enabled: interacaoIds.length > 0,
  });

  const getDocsForInteracao = (interacaoId: string) =>
    interacaoDocs.filter((d) => d.interacao_id === interacaoId);

  // Save files as cliente_documentos linked to an interacao
  const saveFilesToDocs = async (interacaoId: string, uploadedFiles: UploadedFile[], isContract: boolean) => {
    if (!user || uploadedFiles.length === 0) return;
    const records = uploadedFiles.map((f) => ({
      user_id: user.id,
      cliente_id: cliente.id,
      interacao_id: interacaoId,
      nome: f.name,
      tipo: isContract ? "contract" : f.type,
      url: f.url,
      tamanho: f.size,
    }));
    await supabase.from("cliente_documentos").insert(records);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const tipoLabel = getTipoLabel(tipoId);
      const { data, error } = await supabase.from("cliente_interacoes").insert({
        user_id: user!.id,
        cliente_id: cliente.id,
        tipo: tipoLabel,
        descricao: `${titulo ? titulo + ". " : ""}${descricao}`,
        usuario_nome: user?.email || "Usuário",
      }).select("id").single();
      if (error) throw error;

      // Save files linked to this interação + Documentos tab
      const isContract = tipoLabel.toLowerCase() === "contrato";
      await saveFilesToDocs(data.id, files, isContract);
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [
        ["cliente-interacoes", cliente.id],
        ["cliente-documentos", cliente.id],
        ["cliente-interacao-docs", cliente.id],
      ]);
      toast.success("Atividade registrada");
      setTitulo("");
      setDescricao("");
      setTipoId("");
      setFiles([]);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, tipo, descricao, newFiles }: { id: string; tipo: string; descricao: string; newFiles: UploadedFile[] }) => {
      const tipoLabel = getTipoLabel(tipo);
      const { error } = await supabase
        .from("cliente_interacoes")
        .update({ tipo: tipoLabel, descricao })
        .eq("id", id);
      if (error) throw error;

      // Save any new files
      if (newFiles.length > 0) {
        const isContract = tipoLabel.toLowerCase() === "contrato";
        await saveFilesToDocs(id, newFiles, isContract);
      }
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [
        ["cliente-interacoes", cliente.id],
        ["cliente-documentos", cliente.id],
        ["cliente-interacao-docs", cliente.id],
      ]);
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
      await refreshQueries(queryClient, [
        ["cliente-interacoes", cliente.id],
        ["cliente-documentos", cliente.id],
      ]);
      toast.success("Atividade excluída");
      setDeleteId(null);
    },
  });

  const startEdit = (item: any) => {
    const { title, body } = parseInteracao(item.descricao);
    const matchingTipo = tipos.find((t: any) => t.nome === item.tipo);
    setEditingId(item.id);
    setEditTipoId(matchingTipo ? matchingTipo.id : "");
    setEditTitulo(title);
    setEditDescricao(body);
    // Load existing files for display (read-only, new files can be added)
    const existingDocs = getDocsForInteracao(item.id);
    setEditFiles(existingDocs.map((d) => ({
      name: d.nome,
      url: d.url,
      size: d.tamanho || 0,
      type: d.tipo || "",
    })));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const fullDesc = `${editTitulo ? editTitulo + ". " : ""}${editDescricao}`;
    // Only send truly new files (not already saved)
    const existingUrls = new Set(getDocsForInteracao(editingId).map((d) => d.url));
    const newFiles = editFiles.filter((f) => !existingUrls.has(f.url));
    updateMutation.mutate({ id: editingId, tipo: editTipoId, descricao: fullDesc, newFiles });
  };

  // ---------- Financial snapshot for AI summary & macro overview ----------
  const { data: finData } = useQuery({
    queryKey: ["cliente-fin-snapshot", cliente.id],
    queryFn: async () => {
      const [pagar, receber] = await Promise.all([
        supabase.from("accounts_payable").select("amount,due_date,status,description,payment_date").eq("cliente_id", cliente.id),
        supabase.from("accounts_receivable").select("amount,due_date,status,description,payment_date").eq("cliente_id", cliente.id),
      ]);
      return {
        pagar: pagar.data || [],
        receber: receber.data || [],
      };
    },
  });

  const macro = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

    const buckets = (rows: any[]) => {
      let overdueCount = 0, overdueAmount = 0;
      let dueSoonCount = 0, dueSoonAmount = 0;
      let openCount = 0, openAmount = 0;
      let paidCount = 0, paidAmount = 0;
      for (const r of rows) {
        const amt = Number(r.amount || 0);
        if (r.status === "paid") { paidCount++; paidAmount += amt; continue; }
        if (r.status === "cancelled") continue;
        const due = new Date(r.due_date + "T00:00:00");
        if (due < today) { overdueCount++; overdueAmount += amt; }
        else if (due <= in7) { dueSoonCount++; dueSoonAmount += amt; }
        openCount++; openAmount += amt;
      }
      return { overdueCount, overdueAmount, dueSoonCount, dueSoonAmount, openCount, openAmount, paidCount, paidAmount };
    };

    return {
      pagar: buckets(finData?.pagar || []),
      receber: buckets(finData?.receber || []),
    };
  }, [finData]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ---------- Strategic AI Summary via Lovable AI ----------
  // Build a debounced fingerprint to avoid excessive calls
  const aiPayload = useMemo(() => ({
    cliente: {
      nome: cliente.tipo === "pf" ? cliente.nome_completo : (cliente.nome_fantasia || cliente.razao_social),
      tipo: cliente.tipo,
      ativo: cliente.ativo,
      cidade: cliente.cidade,
      estado: cliente.estado,
      tags: (cliente as any).tags || [],
      criado_em: cliente.created_at,
    },
    receber: macro.receber,
    pagar: macro.pagar,
    interacoes_total: interacoes.length,
    ultima_interacao: interacoes[0]?.created_at || null,
    ultimos_tipos: interacoes.slice(0, 5).map((i) => i.tipo),
  }), [cliente, macro, interacoes]);

  const fingerprint = useMemo(() => JSON.stringify({
    id: cliente.id,
    a: cliente.ativo,
    rO: macro.receber.overdueCount,
    rD: macro.receber.dueSoonCount,
    rP: macro.receber.paidCount,
    pO: macro.pagar.overdueCount,
    pD: macro.pagar.dueSoonCount,
    iT: interacoes.length,
    iL: interacoes[0]?.created_at || "",
  }), [cliente.id, cliente.ativo, macro, interacoes]);

  const { data: aiData, isLoading: aiLoading, isError: aiError } = useQuery({
    queryKey: ["cliente-ai-summary", fingerprint],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cliente-ai-summary", {
        body: aiPayload,
      });
      if (error) throw error;
      return data as { insights: { tone: "danger" | "warn" | "ok" | "info"; text: string }[]; recommendation: string };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const toneStyles: Record<string, string> = {
    danger: "text-destructive",
    warn: "text-amber-400",
    ok: "text-emerald-400",
    info: "text-muted-foreground",
  };
  const toneDot: Record<string, string> = {
    danger: "bg-destructive",
    warn: "bg-amber-400",
    ok: "bg-emerald-400",
    info: "bg-muted-foreground/50",
  };

  // ---------- Macro overview lines (above timeline) ----------
  const macroLines = useMemo(() => {
    const out: { icon: typeof AlertTriangle; tone: string; text: string }[] = [];

    if (macro.receber.overdueCount > 0) {
      const label = macro.receber.overdueCount === 1 ? "Conta a Receber venceu" : "Contas a Receber venceram";
      out.push({
        icon: AlertTriangle, tone: "text-destructive",
        text: `${macro.receber.overdueCount} ${label} no valor de ${fmt(macro.receber.overdueAmount)}.`,
      });
    }
    const recRemaining = macro.receber.openCount - macro.receber.overdueCount;
    if (recRemaining > 0) {
      const remAmount = macro.receber.openAmount - macro.receber.overdueAmount;
      out.push({
        icon: Calendar, tone: "text-muted-foreground",
        text: `Ainda há ${recRemaining} ${recRemaining === 1 ? "outra conta a receber" : "outras contas a receber"} no valor de ${fmt(remAmount)}.`,
      });
    }
    if (macro.receber.paidCount > 0) {
      out.push({
        icon: CheckCircle2, tone: "text-emerald-400",
        text: `${macro.receber.paidCount} ${macro.receber.paidCount === 1 ? "recebimento confirmado" : "recebimentos confirmados"} totalizando ${fmt(macro.receber.paidAmount)}.`,
      });
    }
    if (macro.pagar.overdueCount > 0) {
      const label = macro.pagar.overdueCount === 1 ? "Conta a Pagar venceu" : "Contas a Pagar venceram";
      out.push({
        icon: AlertTriangle, tone: "text-amber-400",
        text: `${macro.pagar.overdueCount} ${label} no valor de ${fmt(macro.pagar.overdueAmount)}.`,
      });
    }
    const payRemaining = macro.pagar.openCount - macro.pagar.overdueCount;
    if (payRemaining > 0) {
      const remAmount = macro.pagar.openAmount - macro.pagar.overdueAmount;
      out.push({
        icon: TrendingDown, tone: "text-muted-foreground",
        text: `Ainda há ${payRemaining} ${payRemaining === 1 ? "outra conta a pagar" : "outras contas a pagar"} no valor de ${fmt(remAmount)}.`,
      });
    }
    if (interacoes.length > 0) {
      out.push({
        icon: FileText, tone: "text-muted-foreground",
        text: `${interacoes.length} ${interacoes.length === 1 ? "interação registrada" : "interações registradas"} na linha do tempo.`,
      });
    }
    return out;
  }, [macro, interacoes]);

  return (
    <div className="space-y-6">
      {/* AI Summary - Customer Success (strategic, non-redundant with macro card) */}
      <Card className="p-5 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-primary">Resumo IA — Customer Success</p>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 font-medium">Live</span>
            </div>

            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analisando dados do cliente…
              </div>
            )}

            {aiError && !aiLoading && (
              <p className="text-sm text-muted-foreground">
                Não foi possível gerar a análise estratégica neste momento. Tente novamente em instantes.
              </p>
            )}

            {aiData && !aiLoading && (
              <>
                <ul className="space-y-1.5">
                  {aiData.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${toneDot[ins.tone]}`} />
                      <span className={toneStyles[ins.tone]}>{ins.text}</span>
                    </li>
                  ))}
                </ul>
                {aiData.recommendation && (
                  <div className="mt-3 pt-3 border-t border-primary/10 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground/90">
                      <span className="font-semibold text-primary">Recomendação: </span>
                      {aiData.recommendation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Macro overview */}
      {macroLines.length > 0 && (
        <Card className="p-5 border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Visão Macro do Cliente</p>
          </div>
          <ul className="space-y-2">
            {macroLines.map((line, i) => {
              const Icon = line.icon;
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${line.tone}`} />
                  <span>{line.text}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

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
              placeholder="Ex: Reunião de alinhamento"
            />
            <ManagedSelectInput
              label="Tipo"
              value={tipoId}
              onValueChange={setTipoId}
              options={tipoOptions}
              placeholder="Selecione o tipo..."
              onAdd={managed.onAdd}
              onEdit={managed.onEdit}
              onDelete={managed.onDelete}
              onReorder={managed.onReorder}
              addLabel="Novo tipo"
            />
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
          <MultiFileAttachment
            files={files}
            onFilesChange={setFiles}
            label="Anexos (opcional)"
            folder={`clientes/${cliente.id}/atividades`}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setFiles([]); }}>Cancelar</Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => createMutation.mutate()}
              disabled={!descricao.trim() || !tipoId || createMutation.isPending}
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
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border/40" />

          {interacoes.map((item) => {
            const { title, body } = parseInteracao(item.descricao);
            const colorClass = tipoColors[item.tipo] || "text-muted-foreground";
            const linkedDocs = getDocsForInteracao(item.id);

            return (
              <div key={item.id} className="relative pb-6 last:pb-0 group">
                <div className="absolute -left-[13px] top-3 w-3 h-3 rounded-full border-2 border-border bg-card" />

                <Card className="ml-4 p-5 border-border/40 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${colorClass}`}>📌</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{title}</span>
                          {linkedDocs.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="w-3 h-3" /> {linkedDocs.length}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{item.tipo}</span>
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

                  {body && <p className="text-sm text-muted-foreground mt-2">{body}</p>}

                  {/* Attached files preview */}
                  {linkedDocs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {linkedDocs.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/40 text-xs text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{doc.nome}</span>
                        </a>
                      ))}
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
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) { setEditingId(null); setEditFiles([]); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Título"
                value={editTitulo}
                onChange={(e) => setEditTitulo(e.target.value)}
                placeholder="Ex: Reunião de alinhamento"
              />
              <ManagedSelectInput
                label="Tipo"
                value={editTipoId}
                onValueChange={setEditTipoId}
                options={tipoOptions}
                placeholder="Selecione o tipo..."
                onAdd={managed.onAdd}
                onEdit={managed.onEdit}
                onDelete={managed.onDelete}
                onReorder={managed.onReorder}
                addLabel="Novo tipo"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
              <Textarea
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                className="min-h-[100px] text-sm"
              />
            </div>
            <MultiFileAttachment
              files={editFiles}
              onFilesChange={setEditFiles}
              label="Anexos"
              folder={`clientes/${cliente.id}/atividades`}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditFiles([]); }}>Cancelar</Button>
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
