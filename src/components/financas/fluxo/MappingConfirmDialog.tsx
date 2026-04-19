import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, ArrowRight, FileSpreadsheet, Database } from "lucide-react";
import {
  autoDetectMapping,
  parseAmount,
  parseDateSmart,
  type ColumnMapping,
  type DateFormatHint,
} from "@/lib/cashflow-helpers";

const NONE = "__none__";

interface Props {
  open: boolean;
  rawRows: Record<string, unknown>[];
  onCancel: () => void;
  onConfirm: (mapping: ColumnMapping) => void;
}

const FIELDS: Array<{ key: keyof ColumnMapping; label: string; required: boolean; help: string }> = [
  { key: "dateKey", label: "Data", required: true, help: "Data prevista do lançamento" },
  { key: "amountKey", label: "Valor", required: true, help: "Valor monetário (positivo ou negativo)" },
  { key: "descKey", label: "Descrição", required: true, help: "Texto descritivo do lançamento" },
  { key: "dirKey", label: "Tipo (entrada/saída)", required: false, help: "Opcional. Se ausente, infere pelo sinal do valor" },
  { key: "docKey", label: "Documento", required: false, help: "Nº do documento, NF, boleto" },
  { key: "catKey", label: "Categoria", required: false, help: "Classificação ou plano de contas" },
  { key: "notesKey", label: "Observações", required: false, help: "Notas adicionais" },
];

export function MappingConfirmDialog({ open, rawRows, onCancel, onConfirm }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // Re-run auto-detect every time a new file is loaded
  useEffect(() => {
    if (open && rawRows.length > 0) {
      setMapping(autoDetectMapping(rawRows));
    }
  }, [open, rawRows]);

  const allColumns = useMemo(
    () => (rawRows[0] ? Object.keys(rawRows[0]) : []),
    [rawRows],
  );

  const previewRows = useMemo(() => rawRows.slice(0, 5), [rawRows]);

  const update = (k: keyof ColumnMapping, v: string) => {
    setMapping((m) => ({ ...m, [k]: v === NONE ? undefined : v }));
  };

  const isReady = !!mapping.dateKey && !!mapping.amountKey && !!mapping.descKey;

  const sampleParsed = useMemo(() => {
    return previewRows.map((r) => {
      const dateRaw = mapping.dateKey ? r[mapping.dateKey] : "";
      const amountRaw = mapping.amountKey ? r[mapping.amountKey] : "";
      const descRaw = mapping.descKey ? r[mapping.descKey] : "";
      return {
        date: parseDateSmart(dateRaw, mapping.dateFormat ?? "auto"),
        dateRaw: String(dateRaw ?? ""),
        amount: parseAmount(amountRaw),
        amountRaw: String(amountRaw ?? ""),
        desc: String(descRaw ?? "").trim(),
      };
    });
  }, [previewRows, mapping]);

  const fmtMoney = (n: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Confirme o mapeamento das colunas
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            O sistema detectou automaticamente as colunas. Revise e ajuste se necessário antes de importar.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Mapping fields - layout SaaS -> CSV */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Database className="w-3.5 h-3.5" />
                Campo do sistema
              </div>
              <div className="w-5" />
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Coluna do arquivo
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/40">
              {FIELDS.map((f) => {
                const value = (mapping[f.key] as string | undefined) ?? "";
                const wasAutoDetected = !!value;
                return (
                  <div
                    key={f.key as string}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    {/* Left: system field */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-foreground truncate">
                          {f.label}
                          {f.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{f.help}</p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />

                    {/* Right: file column */}
                    <div className="min-w-0 flex items-center gap-2">
                      <Select value={value || NONE} onValueChange={(v) => update(f.key, v)}>
                        <SelectTrigger className="h-9 text-sm flex-1">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          {!f.required && <SelectItem value={NONE}>— Nenhuma —</SelectItem>}
                          {allColumns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {wasAutoDetected && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary shrink-0">
                          auto
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date format selector */}
          {mapping.dateKey && (
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Label className="text-xs font-medium">Formato de data detectado</Label>
              <Select
                value={mapping.dateFormat ?? "auto"}
                onValueChange={(v) => setMapping((m) => ({ ...m, dateFormat: v as DateFormatHint }))}
              >
                <SelectTrigger className="h-9 text-sm w-full md:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar automaticamente</SelectItem>
                  <SelectItem value="br">Brasileiro (DD/MM/AAAA)</SelectItem>
                  <SelectItem value="us">Americano (MM/DD/AAAA)</SelectItem>
                  <SelectItem value="iso">ISO (AAAA-MM-DD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Live preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Pré-visualização ({previewRows.length} primeiras linhas)</Label>
              {!isReady && (
                <span className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Selecione Data, Valor e Descrição para continuar
                </span>
              )}
            </div>
            <div className="border border-border/60 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[24%]">Data</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[20%]">Valor</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleParsed.map((r, i) => {
                    const dateOk = !!r.date;
                    const amountOk = r.amount != null;
                    const descOk = !!r.desc;
                    return (
                      <tr key={i} className="border-t border-border/40">
                        <td className={`px-3 py-2 ${dateOk ? "text-foreground" : "text-destructive"}`}>
                          {dateOk ? r.date : `❌ ${r.dateRaw || "vazio"}`}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${amountOk ? "text-foreground" : "text-destructive"}`}>
                          {amountOk ? fmtMoney(r.amount) : `❌ ${r.amountRaw || "vazio"}`}
                        </td>
                        <td className={`px-3 py-2 truncate max-w-0 ${descOk ? "text-foreground" : "text-destructive"}`}>
                          {descOk ? r.desc : "❌ vazio"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(mapping)} disabled={!isReady}>
            Confirmar e processar {rawRows.length} linha(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
