import { useEffect, useState } from "react";
import { Users, Loader2, RefreshCw, Building2, User as UserIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { refreshQueries } from "@/lib/query-refresh";

interface QSAImportModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  /** Quando true: chama a edge function sync-qsa-empresas (requer empresaId já criada).
   *  Quando false: usa lista pré-buscada (preview na criação da empresa). */
  fetchFromBackend?: boolean;
  preloadedQsa?: QsaItem[];
  cnpj?: string;
}

export interface QsaItem {
  nome: string;
  documento: string;
  documento_completo?: boolean;
  documento_mascarado?: boolean;
  tipo_pessoa: "PF" | "PJ";
  qualificacao?: string;
  percentual_participacao?: number;
  data_entrada?: string | null;
}

function fmtDoc(doc: string, tipo: "PF" | "PJ") {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (tipo === "PF" && d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (tipo === "PJ" && d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (tipo === "PF" && d.length === 6) return `***.${d.slice(0, 3)}.${d.slice(3)}-** (parcial)`;
  return doc;
}

export function QSAImportModal({
  open, onOpenChange, empresaId, fetchFromBackend = true, preloadedQsa, cnpj,
}: QSAImportModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<QsaItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [existingDocs, setExistingDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setItems([]); setSelected({}); setExistingDocs(new Set());

    const load = async () => {
      setLoading(true);
      try {
        // Busca sócios já cadastrados pra evitar duplicação visual
        if (empresaId) {
          const { data: ex } = await supabase
            .from("empresa_socios")
            .select("documento")
            .eq("empresa_id", empresaId);
          setExistingDocs(new Set((ex ?? []).map((e: any) => (e.documento || "").replace(/\D/g, ""))));
        }

        let qsa: QsaItem[] = [];
        if (preloadedQsa && preloadedQsa.length > 0) {
          qsa = preloadedQsa;
        } else if (cnpj) {
          // Re-puxa via consulta-cnpj
          const { data } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj } });
          qsa = (data?.qsa ?? []) as QsaItem[];
        } else if (empresaId) {
          // Busca pelo CNPJ da empresa
          const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", empresaId).maybeSingle();
          if (emp?.cnpj) {
            const { data } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj: emp.cnpj } });
            qsa = (data?.qsa ?? []) as QsaItem[];
          }
        }

        setItems(qsa);
        // Pré-seleciona todos os ainda não cadastrados
        const sel: Record<string, boolean> = {};
        qsa.forEach((q) => { sel[q.documento] = !existingDocs.has(q.documento); });
        setSelected(sel);
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar Quadro Societário");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresaId, cnpj]);

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    items.forEach((q) => { if (!existingDocs.has(q.documento)) next[q.documento] = v; });
    setSelected(next);
  };

  const handleImport = async () => {
    if (!empresaId) { toast.error("Empresa não identificada"); return; }
    const toImport = items.filter((q) => selected[q.documento] && !existingDocs.has(q.documento));
    if (toImport.length === 0) {
      toast.info("Nenhum sócio selecionado para importação");
      return;
    }
    setImporting(true);
    try {
      if (fetchFromBackend) {
        // Usa edge function pra UPSERT consistente
        await supabase.functions.invoke("sync-qsa-empresas", { body: { empresa_id: empresaId } });
      } else {
        // Insere direto (caso preview com lista já carregada)
        const { data: emp } = await supabase.from("empresas").select("user_id").eq("id", empresaId).maybeSingle();
        if (!emp) throw new Error("Empresa não encontrada");

        const rows = toImport.map((q) => ({
          empresa_id: empresaId,
          user_id: emp.user_id,
          nome_completo: q.nome,
          documento: q.documento,
          // Só preenche CPF se vier completo da Receita; mascarado precisa de complemento manual
          cpf: q.tipo_pessoa === "PF" && q.documento_completo ? q.documento : null,
          tipo_pessoa: q.tipo_pessoa,
          qualificacao: q.qualificacao || null,
          cargo: q.qualificacao || null,
          percentual_participacao: q.percentual_participacao || 0,
          data_entrada: q.data_entrada || null,
          administrador: /administrador/i.test(q.qualificacao || ""),
          origem: "receita_federal" as const,
          status_socio: "ativo" as const,
          ativo: true,
        }));
        const { error } = await supabase.from("empresa_socios").insert(rows);
        if (error) throw error;
        await supabase.from("empresas").update({ last_qsa_sync_at: new Date().toISOString() }).eq("id", empresaId);
      }

      toast.success(`${toImport.length} sócio(s) importado(s) da Receita Federal`);
      await refreshQueries(queryClient, [["empresa_socios"], ["empresas"]]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar sócios");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = items.filter((q) => selected[q.documento] && !existingDocs.has(q.documento)).length;
  const importableCount = items.filter((q) => !existingDocs.has(q.documento)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Quadro Societário — Receita Federal
          </DialogTitle>
          <DialogDescription>
            Sócios identificados oficialmente no QSA. Selecione quais importar; depois você pode complementar
            os dados (RG, endereço, contato, banco, PIX) editando cada sócio.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Consultando Receita Federal…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center border border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum sócio identificado no QSA da Receita Federal.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Você ainda pode cadastrar sócios manualmente no Quadro Societário.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-muted-foreground">
                {items.length} sócio(s) encontrado(s) • {existingDocs.size > 0 && `${existingDocs.size} já cadastrado(s) • `}
                {selectedCount} selecionado(s)
              </p>
              {importableCount > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>Marcar todos</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Limpar</Button>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((q) => {
                const already = existingDocs.has(q.documento);
                return (
                  <div
                    key={q.documento}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/50 ${already ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      checked={!!selected[q.documento]}
                      disabled={already}
                      onCheckedChange={(v) => setSelected((p) => ({ ...p, [q.documento]: !!v }))}
                    />
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {q.tipo_pessoa === "PJ" ? (
                        <Building2 className="h-4 w-4 text-primary" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{q.nome}</p>
                        <Badge variant="outline" className="h-5 text-[10px]">{q.tipo_pessoa}</Badge>
                        {already && <Badge variant="secondary" className="h-5 text-[10px]">Já cadastrado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {q.qualificacao || "Sócio"} • {fmtDoc(q.documento, q.tipo_pessoa)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {Number(q.percentual_participacao ?? 0).toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">capital</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {items.length === 0 ? "Fechar" : "Pular"}
          </Button>
          {importableCount > 0 && (
            <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Importar {selectedCount} sócio(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
