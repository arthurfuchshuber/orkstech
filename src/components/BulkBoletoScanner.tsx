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
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  ScanLine, Upload, Loader2, CheckCircle2, XCircle, FileText, X, AlertTriangle,
} from "lucide-react";
import { createAccountPayable, fetchAccountsPayable, type AccountPayableInsert } from "@/lib/accounts-payable-helpers";

interface BulkResult {
  fileName: string;
  status: "pending" | "scanning" | "success" | "error" | "duplicate";
  message?: string;
  data?: any;
  record?: AccountPayableInsert;
  dupReasons?: string[];
  dupMatches?: any[];
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

  // Duplicate resolution state
  const [dupAlertIndex, setDupAlertIndex] = useState<number | null>(null);
  const [dupDetailItem, setDupDetailItem] = useState<any | null>(null);

  const reset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setProcessing(false);
    setCurrentIndex(0);
    setDone(false);
    setDupAlertIndex(null);
    setDupDetailItem(null);
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

  const checkDuplicates = (record: AccountPayableInsert, existingPayables: any[]): { reasons: string[]; matches: any[] } => {
    const allMatches: any[] = [];

    for (const existing of existingPayables) {
      if (existing.status === "cancelled") continue;

      // Prioridade 1: Nº Documento igual → duplicata imediata
      const recDoc = (record.document_number || "").replace(/\D/g, "");
      const existDoc = (existing.document_number || "").replace(/\D/g, "");
      if (recDoc && existDoc && recDoc === existDoc) {
        allMatches.push({ ...existing, _dupReasons: ["Nº Documento igual"] });
        continue;
      }

      // Prioridade 2 (só se Nº Documento vazio): Nome do beneficiário + Valor iguais
      if (!recDoc) {
        const sameAmount = record.amount > 0 && Math.abs(record.amount - existing.amount) < 0.01;

        let sameBeneficiary = false;
        if (record.supplier_id && existing.supplier_id && record.supplier_id === existing.supplier_id) {
          sameBeneficiary = true;
        } else if (record.supplier_name && existing.supplier_name &&
            record.supplier_name.trim().toLowerCase() === existing.supplier_name.trim().toLowerCase()) {
          sameBeneficiary = true;
        }

        if (sameAmount && sameBeneficiary) {
          allMatches.push({ ...existing, _dupReasons: ["Mesmo beneficiário", "Mesmo valor"] });
        }
      }
    }

    if (allMatches.length > 0) {
      const allReasons = [...new Set(allMatches.flatMap(m => m._dupReasons))];
      return { reasons: allReasons, matches: allMatches };
    }
    return { reasons: [], matches: [] };
  };

  const processFiles = async () => {
    if (!user || files.length === 0) return;
    setProcessing(true);
    setDone(false);

    // Fetch current payables for duplicate checking
    let existingPayables: any[] = [];
    try {
      existingPayables = await fetchAccountsPayable(empresaId);
    } catch { /* ignore */ }

    let successCount = 0;
    let errorCount = 0;
    let dupCount = 0;

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

        // Check duplicates
        const { reasons, matches } = checkDuplicates(record, existingPayables);
        if (reasons.length > 0) {
          dupCount++;
          setResults(prev => prev.map((r, idx) => idx === i ? {
            ...r,
            status: "duplicate",
            message: `Possível duplicata: ${reasons.join(", ")}`,
            data: extracted,
            record,
            dupReasons: reasons,
            dupMatches: matches,
          } : r));
        } else {
          // No duplicate — save directly
          await createAccountPayable([record]);
          successCount++;

          // Add to existing for subsequent checks
          existingPayables.push({
            ...record,
            id: `temp-${i}`,
            status: "pending",
          });

          setResults(prev => prev.map((r, idx) => idx === i ? {
            ...r,
            status: "success",
            message: `${extracted.description || "Conta"} — R$ ${(record.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            data: extracted,
          } : r));
        }
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

    if (dupCount > 0) {
      toast.info(`${dupCount} boleto(s) com possível duplicata aguardando sua decisão`);
    } else if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} boleto(s) processado(s) com sucesso!`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} processado(s), ${errorCount} com erro`);
    } else {
      toast.error(`Nenhum boleto processado com sucesso`);
    }
  };

  const handleForceSave = async (idx: number) => {
    const result = results[idx];
    if (!result.record) return;

    try {
      await createAccountPayable([result.record]);
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r,
        status: "success",
        message: `${r.record?.description || "Conta"} — R$ ${(r.record?.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (salvo manualmente)`,
      } : r));
      toast.success(`Boleto "${result.fileName}" salvo com sucesso`);
      await queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      await queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
    setDupAlertIndex(null);
  };

  const handleSkipDuplicate = (idx: number) => {
    setResults(prev => prev.map((r, i) => i === idx ? {
      ...r,
      status: "error",
      message: "Ignorado pelo usuário (duplicata)",
    } : r));
    setDupAlertIndex(null);
  };

  const progress = files.length > 0 ? (currentIndex / files.length) * 100 : 0;
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const dupCount = results.filter(r => r.status === "duplicate").length;

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
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
                        {dupCount > 0 && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1">
                            <AlertTriangle className="w-3 h-3" /> {dupCount}
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
                          r.status === "duplicate" ? "border-amber-200/50 bg-amber-500/5" :
                          r.status === "scanning" ? "border-primary/30 bg-primary/5" :
                          "border-border/50 bg-muted/20"
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {r.status === "scanning" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                          {r.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {r.status === "error" && <XCircle className="w-4 h-4 text-red-500" />}
                          {r.status === "duplicate" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          {r.status === "pending" && <FileText className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{r.fileName}</p>
                          {r.message && (
                            <p className={`text-xs mt-0.5 ${
                              r.status === "error" ? "text-red-500" :
                              r.status === "duplicate" ? "text-amber-600" :
                              "text-muted-foreground"
                            }`}>
                              {r.message}
                            </p>
                          )}
                          {r.status === "duplicate" && (
                            <button
                              type="button"
                              onClick={() => setDupAlertIndex(i)}
                              className="text-xs text-primary hover:underline mt-1 font-medium"
                            >
                              Resolver duplicata →
                            </button>
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

      {/* Duplicate resolution alert */}
      <AlertDialog open={dupAlertIndex !== null} onOpenChange={(open) => { if (!open) setDupAlertIndex(null); }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Possível Duplicata Detectada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                {dupAlertIndex !== null && results[dupAlertIndex] && (
                  <>
                    <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
                      <p className="text-sm font-medium text-foreground">
                        {results[dupAlertIndex].record?.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor: {formatCurrency(results[dupAlertIndex].record?.amount || 0)} •
                        Vencimento: {results[dupAlertIndex].record?.due_date}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">Registros semelhantes encontrados:</p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {results[dupAlertIndex].dupMatches?.map((dup: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDupDetailItem(dup)}
                          className="w-full text-left p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <p className="text-sm font-medium text-foreground">{dup.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(dup.amount)} • Vence: {dup.due_date}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {dup._dupReasons?.map((r: string, ri: number) => (
                              <Badge key={ri} variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-200">
                                {r}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-primary mt-1.5">Clique para ver detalhes →</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => dupAlertIndex !== null && handleSkipDuplicate(dupAlertIndex)}>
              Ignorar boleto
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => dupAlertIndex !== null && handleForceSave(dupAlertIndex)}>
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail modal for existing duplicate */}
      <Dialog open={!!dupDetailItem} onOpenChange={(open) => { if (!open) setDupDetailItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Conta Existente</DialogTitle>
          </DialogHeader>
          {dupDetailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Descrição</p>
                  <p className="font-medium">{dupDetailItem.description}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Valor</p>
                  <p className="font-medium">{formatCurrency(dupDetailItem.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Vencimento</p>
                  <p className="font-medium">{dupDetailItem.due_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant="outline" className="mt-0.5">
                    {dupDetailItem.status === "pending" ? "Pendente" :
                     dupDetailItem.status === "paid" ? "Pago" :
                     dupDetailItem.status === "overdue" ? "Vencido" : dupDetailItem.status}
                  </Badge>
                </div>
                {dupDetailItem.document_number && (
                  <div>
                    <p className="text-muted-foreground text-xs">Nº Documento</p>
                    <p className="font-medium">{dupDetailItem.document_number}</p>
                  </div>
                )}
                {dupDetailItem.supplier_name && (
                  <div>
                    <p className="text-muted-foreground text-xs">Fornecedor</p>
                    <p className="font-medium">{dupDetailItem.supplier_name}</p>
                  </div>
                )}
              </div>
              {dupDetailItem._dupReasons && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-border/30">
                  {dupDetailItem._dupReasons.map((r: string, i: number) => (
                    <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
