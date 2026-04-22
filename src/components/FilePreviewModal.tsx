import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useMemo } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  nome?: string | null;
  mime?: string | null;
}

function detectKind(url: string | null, mime?: string | null): "pdf" | "image" | "other" {
  if (!url) return "other";
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(lower)) return "image";
  return "other";
}

export function FilePreviewModal({ open, onOpenChange, url, nome, mime }: Props) {
  const kind = useMemo(() => detectKind(url, mime), [url, mime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/50 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-medium truncate pr-4">
            {nome || "Visualização"}
          </DialogTitle>
          {url && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={url} download={nome || true} title="Baixar">
                  <Download className="w-4 h-4" />
                </a>
              </Button>
            </div>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30">
          {!url ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Arquivo indisponível
            </div>
          ) : kind === "pdf" ? (
            <iframe src={url} title={nome || "PDF"} className="w-full h-full border-0" />
          ) : kind === "image" ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img src={url} alt={nome || "Imagem"} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Pré-visualização não disponível para este formato.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova aba
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
