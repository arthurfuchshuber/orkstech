import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ScanLine, Upload, Loader2, CheckCircle2, XCircle, FileText, X,
} from "lucide-react";
import { createAccountPayable, type AccountPayableInsert } from "@/lib/accounts-payable-helpers";

interface BulkResult {
  fileName: string;
  status: "pending" | "scanning" | "success" | "error";
  message?: string;
  data?: any;
}

interface BulkBoletoScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedores: any[];
}

export function BulkBoletoScanner({ open, onOpenChange, fornecedores }: BulkBoletoScannerProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setProcessing(false);
    setCurrentIndex(0);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = (val: boolean) => {
    if (processing) return;
    if (!val) reset();
    onOpenChange(val);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 10);
    const MAX = 10 * 1024 * 1024;
    const valid = selected.filter(f => {
      if (f.size > MAX) {
        toast.error(`${f.name}: muito grande (máx. 10MB)`);
        return false;
      }
      return true;
    });
    setFiles(valid);
    setResults(valid.map(f => ({ fileName: f.name, status: "pending" })));
    setDone(false);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setResults(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/contas-pagar/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) return null;
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const matchSupplier = (extracted: any) => {
    const supplierCnpj = extracted.supplier_cnpj?.replace(/\D/g, "") || "";
    if (supplierCnpj) {
      const match = fornecedores.find((f: any) => f.cnpj?.replace(/\D/g, "") === supplierCnpj);
      if (match) return { id: match.id, name: match.tipo === "pj" ? (match.nome_fantasia || match.razao_social || "") : (match.nome_completo || "") };
    }
    if (extracted.supplier_name) {
      const nameLower = extracted.supplier_name.toLowerCase();
      const match = fornecedores.find((f: any) => {
        const rz = (f.razao_social || "").toLowerCase();
        const nf = (f.nome_fantasia || "").toLowerCase();
        const nc = (f.nome_completo || "").toLowerCase();
        return rz === nameLower || nf === nameLower || nc === nameLower;
      });
      if (match) return { id: match.id, name: match.tipo === "pj" ? (match.nome_fantasia || match.razao_social || "") : (match.nome_completo || "") };
    }
    return null;
  };

  const processFiles = async () => {
    if (!user || files.length === 0) return;
    setProcessing(true);
    setDone(false);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "scanning" } : r));

      try {
        const [base64, attachmentUrl] = await Promise.all([
          fileToBase64(files[i]),
          uploadFile(files[i]),
        ]);

        const { data, error } = await supabase.functions.invoke("scan-boleto", {
          body: { file_base64: base64, file_type: files[i].type },
        });

        if (error) throw new Error("Erro na análise");
        if (data?.error) throw new Error(data.error);
        const extracted = data?.data;
        if (!extracted) throw new Error("Sem dados extraídos");

        const supplier = matchSupplier(extracted);

        const record: AccountPayableInsert = {
          user_id: user.id,
          empresa_id: empresaId || undefined,
          description: extracted.description || files[i].name,
          supplier_id: supplier?.id || null,
          supplier_name: supplier?.name || extracted.supplier_name || null,
          document_number: extracted.document_number || null,
          amount: extracted.amount ? extracted.amount / 100 : 0,
          due_date: extracted.due_date || new Date().toISOString().split("T")[0],
          notes: extracted.barcode ? `Linha digitável: ${extracted.barcode}` : null,
          attachment_url: attachmentUrl || null,
          pessoa_tipo: "pj",
        };

        await createAccountPayable([record]);
        successCount++;

        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: "success",
          message: `${extracted.description || "Conta"} — R$ ${(record.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          data: extracted,
        } : r));
      } catch (err: any) {
        errorCount++;
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r,
          status: "error",
          message: err.message || "Erro desconhecido",
        } : r));
      }
    }

    setProcessing(false);
    setDone(true);
    setCurrentIndex(files.length);

    await queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    await queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} boleto(s) processado(s) com sucesso!`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} processado(s), ${errorCount} com erro`);
    } else {
      toast.error(`Nenhum boleto processado com sucesso`);
    }
  };

  const progress = files.length > 0 ? (currentIndex / files.length) * 100 : 0;
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 border-border/50 bg-card shadow-2xl rounded-xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            Escanear Boletos em Massa
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Selecione até 10 boletos (PDF ou imagem) para processamento automático.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="px-6 py-5 space-y-4">
            {/* File selection */}
            {!processing && !done && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 w-full p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.06] hover:border-primary/50 transition-all duration-200 cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-primary/60" />
                  <p className="text-sm font-medium text-foreground">Clique para selecionar arquivos</p>
                  <p className="text-xs text-muted-foreground">Máximo 10 arquivos • PDF, JPG, PNG (até 10MB cada)</p>
                </button>
              </>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {files.length} arquivo(s) selecionado(s)
                  </p>
                  {done && (
                    <div className="flex gap-2">
                      {successCount > 0 && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {successCount}
                        </Badge>
                      )}
                      {errorCount > 0 && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 gap-1">
                          <XCircle className="w-3 h-3" /> {errorCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {processing && (
                  <div className="space-y-1.5">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Processando {currentIndex + 1} de {files.length}...
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
                        r.status === "success" ? "border-emerald-200/50 bg-emerald-500/5" :
                        r.status === "error" ? "border-red-200/50 bg-red-500/5" :
                        r.status === "scanning" ? "border-primary/30 bg-primary/5" :
                        "border-border/50 bg-muted/20"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {r.status === "scanning" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                        {r.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {r.status === "error" && <XCircle className="w-4 h-4 text-red-500" />}
                        {r.status === "pending" && <FileText className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{r.fileName}</p>
                        {r.message && (
                          <p className={`text-xs mt-0.5 ${r.status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                            {r.message}
                          </p>
                        )}
                      </div>
                      {!processing && !done && (
                        <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/30">
          {done ? (
            <>
              <Button variant="outline" onClick={() => reset()} className="rounded-lg">
                Processar mais
              </Button>
              <Button onClick={() => handleClose(false)} className="rounded-lg gap-2">
                <CheckCircle2 className="w-4 h-4" /> Concluir
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={processing} className="rounded-lg">
                Cancelar
              </Button>
              <Button
                onClick={processFiles}
                disabled={files.length === 0 || processing}
                className="rounded-lg gap-2"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanLine className="w-4 h-4" />
                )}
                {processing ? "Processando..." : `Processar ${files.length} boleto(s)`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
