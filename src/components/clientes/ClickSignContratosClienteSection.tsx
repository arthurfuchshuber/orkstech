import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, FileSignature, Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            const fileUrl = doc.url_assinado || doc.url_original;
            return (
              <Card
                key={doc.id}
                role={fileUrl ? "button" : undefined}
                tabIndex={fileUrl ? 0 : undefined}
                onClick={() => fileUrl && setPreview({ url: fileUrl, nome: doc.nome })}
                onKeyDown={(e) => {
                  if (fileUrl && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setPreview({ url: fileUrl, nome: doc.nome });
                  }
                }}
                className={cn(
                  "p-4 border-border/40 shadow-sm flex items-center justify-between group hover:border-border/60 transition-colors",
                  fileUrl && "cursor-pointer hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSignature className="w-4 h-4 text-primary" />
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
                {fileUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
