import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link as LinkIcon, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  buildPreview,
  commitImport,
  parseCSV,
  parseGoogleSheetsURL,
  parseXLSX,
  type ImportPreview,
  type CashflowSource,
} from "@/lib/cashflow-helpers";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { cn } from "@/lib/utils";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  onImported?: () => void;
}

export function CashflowImporter({ onImported }: Props) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [tab, setTab] = useState<"file" | "sheets">("file");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [source, setSource] = useState<CashflowSource>("csv");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setFilename("");
    setSheetsUrl("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLoading(true);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      const rows = isXlsx ? await parseXLSX(file) : await parseCSV(file);
      const src: CashflowSource = isXlsx ? "xlsx" : "csv";
      const prev = await buildPreview(rows, user.id, empresaAtiva?.id);
      setPreview(prev);
      setFilename(file.name);
      setSource(src);
      toast.success(`${rows.length} linha(s) lida(s)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao ler arquivo");
    } finally {
      setLoading(false);
    }
  };

  const handleSheets = async () => {
    if (!user || !sheetsUrl.trim()) return;
    setLoading(true);
    try {
      const rows = await parseGoogleSheetsURL(sheetsUrl);
      const prev = await buildPreview(rows, user.id, empresaAtiva?.id);
      setPreview(prev);
      setFilename(sheetsUrl);
      setSource("google_sheets");
      toast.success(`${rows.length} linha(s) lida(s)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao baixar planilha");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async (includeDuplicates: boolean) => {
    if (!user || !preview) return;
    setLoading(true);
    try {
      const res = await commitImport({
        userId: user.id,
        empresaId: empresaAtiva?.id,
        filename,
        source,
        sourceUrl: source === "google_sheets" ? sheetsUrl : undefined,
        preview,
        includeDuplicates,
      });
      toast.success(`${res.insertedCount} previsão(ões) importada(s)`);
      reset();
      onImported?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Importar Previsões Externas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Aceita CSV, Excel (.xlsx) ou link público do Google Sheets. Colunas reconhecidas: <strong>data, valor, descrição, documento, categoria, tipo, observações</strong>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="file"><FileSpreadsheet className="w-4 h-4 mr-2" />Arquivo</TabsTrigger>
              <TabsTrigger value="sheets"><LinkIcon className="w-4 h-4 mr-2" />Google Sheets</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className={cn(
                  "w-full flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed border-border/60",
                  "hover:border-primary/40 hover:bg-primary/[0.03] transition-colors",
                  loading && "opacity-50 cursor-wait"
                )}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">Clique para selecionar CSV ou Excel</span>
                <span className="text-xs text-muted-foreground/60">Máx. 10MB</span>
              </button>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </TabsContent>
            <TabsContent value="sheets" className="mt-4 space-y-3">
              <Label htmlFor="sheetsUrl" className="text-sm">URL pública do Google Sheets</Label>
              <Input
                id="sheetsUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">A planilha precisa estar com permissão "Qualquer pessoa com o link pode ver".</p>
              <Button onClick={handleSheets} disabled={loading || !sheetsUrl.trim()} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                Analisar Planilha
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700">Válidas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{preview.valid.length}</p>
                <p className="text-[11px] text-muted-foreground">{fmt(preview.valid.reduce((s, r) => s + r.amount, 0))}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Duplicadas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{preview.duplicates.length}</p>
                <p className="text-[11px] text-muted-foreground">já existem no sistema</p>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-medium text-rose-700">Inválidas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{preview.invalid.length}</p>
                <p className="text-[11px] text-muted-foreground">erros de formato</p>
              </div>
            </div>

            {preview.duplicates.length > 0 && (
              <div className="border border-amber-500/20 rounded-lg p-3 bg-amber-500/5 max-h-64 overflow-auto">
                <p className="text-xs font-semibold text-amber-700 mb-2">Possíveis duplicatas detectadas</p>
                <div className="space-y-1">
                  {preview.duplicates.slice(0, 20).map((d) => (
                    <div key={d.rowIndex} className="text-xs flex items-center justify-between gap-2 py-1 border-b border-amber-500/10 last:border-0">
                      <span className="text-foreground truncate">Linha {d.rowIndex}: {d.description}</span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">já em {d.duplicateOf.table.replace("accounts_", "").replace("cashflow_forecasts", "previsão")}</Badge>
                    </div>
                  ))}
                  {preview.duplicates.length > 20 && <p className="text-[11px] text-muted-foreground pt-1">+ {preview.duplicates.length - 20} outras</p>}
                </div>
              </div>
            )}

            {preview.invalid.length > 0 && (
              <div className="border border-rose-500/20 rounded-lg p-3 bg-rose-500/5 max-h-48 overflow-auto">
                <p className="text-xs font-semibold text-rose-700 mb-2">Linhas com erro (serão ignoradas)</p>
                <div className="space-y-1">
                  {preview.invalid.slice(0, 10).map((d) => (
                    <p key={d.rowIndex} className="text-xs text-foreground">Linha {d.rowIndex}: {d.errors?.join(", ")}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={reset} disabled={loading}>Cancelar</Button>
              {preview.duplicates.length > 0 && (
                <Button variant="outline" onClick={() => handleCommit(true)} disabled={loading}>
                  Importar tudo (incluindo duplicadas)
                </Button>
              )}
              <Button onClick={() => handleCommit(false)} disabled={loading || preview.valid.length === 0}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Importar {preview.valid.length} válidas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
