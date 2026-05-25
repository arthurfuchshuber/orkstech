import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, FileText, Loader2, Plus, FileSignature, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { refreshQueries } from "@/lib/query-refresh";
import { logClienteEvent } from "@/lib/cliente-history";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilePreviewModal } from "@/components/FilePreviewModal";

interface Props {
  clienteId: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

const CS_STATUS: Record<string, { label: string; className: string }> = {
  running: { label: "Em assinatura", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  waiting: { label: "Aguardando", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  closed: { label: "Assinado", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  auto_closed: { label: "Assinado", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};

type UnifiedContract =
  | { kind: "manual"; id: string; nome: string; created_at: string; tamanho: number | null; tipo: string | null; url: string }
  | { kind: "clicksign"; id: string; nome: string; created_at: string; status: string; finalizado_em: string | null; signatarios: any[] };

export function ClienteDocumentosTab({ clienteId }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const contractRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; nome: string; mime?: string | null; blob?: Blob } | null>(null);
  const [loadingCsId, setLoadingCsId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["cliente-documentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_documentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: csCred } = useQuery({
    queryKey: ["clicksign-cred", empresa?.id],
    queryFn: async () => {
      if (!empresa?.id) return null;
      const { data } = await supabase
        .from("integracoes_credenciais")
        .select("id, ativo")
        .eq("provider", "clicksign")
        .eq("empresa_id", empresa.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!empresa?.id,
  });

  const { data: csDocs = [] } = useQuery({
    queryKey: ["clicksign-cliente-docs", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clicksign_documentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!csCred,
  });

  const isContract = (d: any) => d.tipo?.includes("contract") || d.nome?.toLowerCase().includes("contrato");
  const manualContracts = docs.filter(isContract);
  const documents = docs.filter((d) => !isContract(d));

  const allContracts = useMemo<UnifiedContract[]>(() => {
    const merged: UnifiedContract[] = [
      ...csDocs.map((d: any) => ({
        kind: "clicksign" as const,
        id: d.id,
        nome: d.nome,
        created_at: d.created_at,
        status: d.status,
        finalizado_em: d.finalizado_em,
        signatarios: Array.isArray(d.signatarios) ? d.signatarios : [],
      })),
      ...manualContracts.map((d: any) => ({
        kind: "manual" as const,
        id: d.id,
        nome: d.nome,
        created_at: d.created_at,
        tamanho: d.tamanho,
        tipo: d.tipo,
        url: d.url,
      })),
    ];
    return merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [csDocs, manualContracts]);

  const uploadFile = async (file: File, asContract: boolean) => {
    if (!user) return;
    if (!empresa?.id) {
      toast.error("Selecione uma empresa antes de enviar arquivos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }

    if (asContract) setUploadingContract(true); else setUploading(true);
    try {
      const path = `${empresa.id}/${clienteId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("client-documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(path);

      const { error: dbError } = await supabase.from("cliente_documentos").insert({
        user_id: user.id,
        cliente_id: clienteId,
        nome: file.name,
        tipo: asContract ? "contract" : (file.type || "application/octet-stream"),
        url: urlData.publicUrl,
        tamanho: file.size,
      });
      if (dbError) throw dbError;

      await refreshQueries(queryClient, [["cliente-documentos", clienteId]]);
      logClienteEvent({
        clienteId,
        userId: user.id,
        tipo: asContract ? "Contrato" : "Documento",
        titulo: asContract ? "Contrato enviado" : "Documento enviado",
        descricao: file.name,
        usuarioNome: user.email || "Sistema",
      });
      toast.success(asContract ? "Contrato enviado" : "Documento enviado");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      if (asContract) setUploadingContract(false); else setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (contractRef.current) contractRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const target = docs.find((d) => d.id === docId);
      const { error } = await supabase.from("cliente_documentos").delete().eq("id", docId);
      if (error) throw error;
      return target;
    },
    onSuccess: async (target) => {
      await refreshQueries(queryClient, [["cliente-documentos", clienteId]]);
      if (user && target) {
        logClienteEvent({
          clienteId,
          userId: user.id,
          tipo: target.tipo === "contract" ? "Contrato" : "Documento",
          titulo: target.tipo === "contract" ? "Contrato excluído" : "Documento excluído",
          descricao: target.nome,
          usuarioNome: user.email || "Sistema",
        });
      }
      toast.success("Arquivo excluído");
      setDeleteId(null);
    },
  });

  const openClickSignPreview = async (docId: string, nome: string) => {
    setLoadingCsId(docId);
    setPreview((current) => {
      if (current?.url?.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return { url: null, nome, mime: "application/pdf" };
    });
    try {
      const { data: auth } = await supabase.auth.getSession();
      const accessToken = auth.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clicksign-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "download_document", documento_id: docId, empresa_id: empresa?.id }),
      });

      if (!response.ok) {
        const ct = response.headers.get("content-type") || "";
        const message = ct.includes("application/json")
          ? (await response.json())?.error || "Não foi possível carregar o documento"
          : await response.text();
        throw new Error(message || "Não foi possível carregar o documento");
      }

      const mime = response.headers.get("content-type") || "application/pdf";
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) throw new Error("Documento vazio");

      const blob = new Blob([buffer.slice(0)], { type: mime });
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current?.url?.startsWith("blob:")) URL.revokeObjectURL(current.url);
        return { url, nome, mime, blob };
      });
    } catch (e) {
      console.error("[clicksign preview]", e);
      toast.error("Não foi possível carregar o documento");
      setPreview(null);
    } finally {
      setLoadingCsId(null);
    }
  };

  const closePreview = (open: boolean) => {
    if (!open && preview?.url?.startsWith("blob:")) URL.revokeObjectURL(preview.url);
    if (!open) setPreview(null);
  };

  const ManualItem = ({ doc }: { doc: Extract<UnifiedContract, { kind: "manual" }> }) => (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setPreview({ url: doc.url, nome: doc.nome, mime: doc.tipo })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPreview({ url: doc.url, nome: doc.nome, mime: doc.tipo });
        }
      }}
      className="p-4 border-border/40 shadow-sm flex items-center justify-between group hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{doc.nome}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {doc.tamanho ? ` · ${formatBytes(doc.tamanho)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
          <a href={doc.url} download={doc.nome}><Download className="w-4 h-4" /></a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteId(doc.id); }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );

  const ClickSignItem = ({ doc }: { doc: Extract<UnifiedContract, { kind: "clicksign" }> }) => {
    const meta = CS_STATUS[doc.status] || { label: doc.status, className: "bg-muted text-muted-foreground border-border" };
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={() => openClickSignPreview(doc.id, doc.nome)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openClickSignPreview(doc.id, doc.nome);
          }
        }}
        className={cn(
          "p-4 border-border/40 shadow-sm flex items-center justify-between group hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer",
          loadingCsId === doc.id && "opacity-70"
        )}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {loadingCsId === doc.id ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <FileSignature className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground truncate">{doc.nome}</p>
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 bg-primary/5 text-primary gap-1">
                <FileSignature className="w-2.5 h-2.5" /> ClickSign
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0", meta.className)}>
                {meta.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {doc.finalizado_em && (
                <> · Assinado em {format(new Date(doc.finalizado_em), "dd/MM/yyyy", { locale: ptBR })}</>
              )}
            </p>
            {doc.signatarios.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                <Users className="w-3 h-3" />
                <span className="truncate">
                  {doc.signatarios.map((s: any) => s?.name || s?.email).filter(Boolean).join(", ") || `${doc.signatarios.length} signatário(s)`}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Contratos e aditivos (manuais + ClickSign unificados) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Contratos e aditivos</h3>
          <div>
            <input
              ref={contractRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], true)}
              accept=".pdf,.doc,.docx"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-lg"
              onClick={() => contractRef.current?.click()}
              disabled={uploadingContract}
            >
              {uploadingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Novo Contrato
            </Button>
          </div>
        </div>
        {allContracts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contrato vinculado a este cliente.</p>
        ) : (
          <div className="space-y-2">
            {allContracts.map((c) =>
              c.kind === "clicksign" ? <ClickSignItem key={`cs-${c.id}`} doc={c} /> : <ManualItem key={`m-${c.id}`} doc={c} />
            )}
          </div>
        )}
      </div>

      {/* Documents section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Documentos</h3>
          <div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], false)}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-lg"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Enviar Documento
            </Button>
          </div>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento enviado</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => <ManualItem key={doc.id} doc={{
              kind: "manual", id: doc.id, nome: doc.nome, created_at: doc.created_at,
              tamanho: doc.tamanho, tipo: doc.tipo, url: doc.url,
            }} />)}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
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

      <FilePreviewModal
        open={!!preview}
        onOpenChange={closePreview}
        url={preview?.url || null}
        nome={preview?.nome}
        mime={preview?.mime}
        blob={preview?.blob}
      />
    </div>
  );
}
