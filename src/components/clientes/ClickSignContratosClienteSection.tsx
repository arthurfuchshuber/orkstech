import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileSignature, Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FilePreviewModal } from "@/components/FilePreviewModal";

interface Props {
  clienteId: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  running: { label: "Em assinatura", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  waiting: { label: "Aguardando", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  closed: { label: "Assinado", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  auto_closed: { label: "Assinado", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};

export function ClickSignContratosClienteSection({ clienteId }: Props) {
  const { empresa } = useEmpresa();
  const [preview, setPreview] = useState<{ url: string; nome: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const openPreview = async (docId: string, nome: string) => {
    setLoadingDocId(docId);
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
        const contentType = response.headers.get("content-type") || "";
        const message = contentType.includes("application/json")
          ? (await response.json())?.error || "Não foi possível carregar o documento"
          : await response.text();
        throw new Error(message || "Não foi possível carregar o documento");
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("Documento vazio");

      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current?.url?.startsWith("blob:")) URL.revokeObjectURL(current.url);
        return { url, nome };
      });
    } catch (e) {
      console.error("[clicksign preview]", e);
      const { toast } = await import("sonner");
      toast.error("Não foi possível carregar o documento");
    } finally {
      setLoadingDocId(null);
    }
  };

  const closePreview = (open: boolean) => {
    if (!open && preview?.url?.startsWith("blob:")) URL.revokeObjectURL(preview.url);
    if (!open) setPreview(null);
  };

  // Busca credencial ClickSign ativa para essa empresa
  const { data: cred } = useQuery({
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

  const { data: docs = [], isLoading } = useQuery({
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
    enabled: !!cred,
  });

  // Só renderiza se a integração estiver ativa
  if (!cred) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">Contratos ClickSign</h3>
          <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0 border-primary/30 bg-primary/5 text-primary">
            <FileSignature className="w-2.5 h-2.5" /> Integração
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum contrato do ClickSign vinculado a este cliente.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc: any) => {
            const meta = STATUS_LABEL[doc.status] || { label: doc.status, className: "bg-muted text-muted-foreground border-border" };
            const signers = Array.isArray(doc.signatarios) ? doc.signatarios : [];
            return (
              <Card
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => openPreview(doc.id, doc.nome)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPreview(doc.id, doc.nome);
                  }
                }}
                className={cn(
                  "p-4 border-border/40 shadow-sm flex items-center justify-between group hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer",
                  loadingDocId === doc.id && "opacity-70"
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {loadingDocId === doc.id ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <FileSignature className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{doc.nome}</p>
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
                    {signers.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span className="truncate">
                          {signers.map((s: any) => s?.name || s?.email).filter(Boolean).join(", ") || `${signers.length} signatário(s)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FilePreviewModal
        open={!!preview}
        onOpenChange={closePreview}
        url={preview?.url || null}
        nome={preview?.nome}
        mime="application/pdf"
      />
    </div>
  );
}
