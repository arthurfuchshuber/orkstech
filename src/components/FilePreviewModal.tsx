import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  nome?: string | null;
  mime?: string | null;
  data?: Uint8Array | null;
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

export function FilePreviewModal({ open, onOpenChange, url, nome, mime, data }: Props) {
  const kind = useMemo(() => detectKind(url, mime), [url, mime]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageWidth, setPageWidth] = useState<number>(820);

  useEffect(() => {
    if (!open || kind !== "pdf") return;

    const updateWidth = () => {
      const width = containerRef.current?.clientWidth ?? 820;
      setPageWidth(Math.max(280, Math.min(width - 32, 980)));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [open, kind]);

  useEffect(() => {
    if (!open) setPageCount(0);
  }, [open, url, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/50 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-medium truncate pr-4">
            {nome || "Visualização"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pré-visualização rápida do arquivo selecionado.
          </DialogDescription>
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
            <div ref={containerRef} className="h-full overflow-auto p-4 md:p-6">
              <Document
                key={`${nome || "arquivo"}-${url || "sem-url"}-${data?.byteLength || 0}`}
                file={data ? { data } : url}
                loading={
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando PDF...
                  </div>
                }
                error={
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Não foi possível renderizar este PDF no modal.</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova aba
                      </a>
                    </Button>
                  </div>
                }
                onLoadSuccess={({ numPages }) => setPageCount(numPages)}
                className="mx-auto flex flex-col items-center gap-4"
              >
                {Array.from({ length: pageCount }, (_, index) => (
                  <div key={index + 1} className="overflow-hidden rounded-md border border-border/60 bg-background shadow-sm">
                    <Page
                      pageNumber={index + 1}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                ))}
              </Document>
            </div>
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
