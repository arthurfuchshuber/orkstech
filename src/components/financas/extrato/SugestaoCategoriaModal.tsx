import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, History, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { CriarRegraAutoModal } from "./CriarRegraAutoModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  description: string;
  amount: number; // sinalizado: negativo = saída
  /** Subcategoria atual (se já houver) — para pré-selecionar */
  currentCategoriaId: string | null;
  /** Chamado quando usuário escolhe uma categoria — devolve o ID escolhido (ou null pra ignorar) */
  onApply: (categoriaId: string | null) => void;
  /** Loading externo (salvando) */
  isSaving?: boolean;
}

interface Sugestao {
  categoria_financeira_id: string;
  categoria_nome: string;
  match_count: number;
  exact_count: number;
  similar_count: number;
  sample_descriptions: string[];
  common_term: string | null;
}

/**
 * Modal de Sugestão Inteligente de Categorização.
 * Busca no histórico transações similares e oferece auto-preenchimento.
 * Quando há ≥3 matches, oferece criar uma regra automática.
 */
export function SugestaoCategoriaModal({
  open,
  onOpenChange,
  description,
  amount,
  currentCategoriaId,
  onApply,
  isSaving = false,
}: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const empresaId = empresa?.id ?? null;

  const tipoSugerido: "pagar" | "receber" = amount < 0 ? "pagar" : "receber";

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [criarRegraOpen, setCriarRegraOpen] = useState(false);
  const [regraSeed, setRegraSeed] = useState<{ termo: string; catId: string } | null>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setSelecionada(currentCategoriaId);
    }
  }, [open, currentCategoriaId]);

  const { data: sugestoes = [], isLoading } = useQuery({
    queryKey: ["sugestoes-categoria", targetUserId, empresaId, description, tipoSugerido],
    enabled: !!targetUserId && open && !!description && description.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sugerir_categorias_por_historico" as any, {
        p_user_id: targetUserId,
        p_empresa_id: empresaId,
        p_description: description,
        p_amount: Math.abs(amount),
        p_tipo: tipoSugerido,
      });
      if (error) throw error;
      return (data ?? []) as Sugestao[];
    },
  });

  // todas as categorias (folhas) para o seletor manual
  const { data: categorias = [] } = useQuery({
    queryKey: ["sugestao-cats-list", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, categoria_pai_id")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []).filter((c: any) => c.categoria_pai_id != null);
    },
  });

  // Auto-seleciona a melhor sugestão quando carrega (se nada estiver selecionado)
  useEffect(() => {
    if (open && !selecionada && sugestoes.length > 0) {
      setSelecionada(sugestoes[0].categoria_financeira_id);
    }
  }, [open, sugestoes, selecionada]);

  const top = sugestoes[0];
  const podeCriarRegra = useMemo(() => {
    return !!top && top.match_count >= 3 && !!top.common_term;
  }, [top]);

  const handleCriarRegra = () => {
    if (!top || !top.common_term || !selecionada) return;
    setRegraSeed({ termo: top.common_term, catId: selecionada });
    setCriarRegraOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Categorização sugerida
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta transação ainda não tem subcategoria. Veja o que encontramos no seu histórico.
            </DialogDescription>
          </DialogHeader>

          {/* Transação atual */}
          <div className="rounded-md bg-muted/30 border border-border/30 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Transação</div>
            <div className="text-sm font-medium truncate">{description || "—"}</div>
            <div className="text-xs text-muted-foreground">
              {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·{" "}
              <span className="capitalize">{tipoSugerido === "pagar" ? "Saída" : "Entrada"}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Procurando padrões no histórico...
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="rounded-md border border-border/40 p-3 text-xs text-muted-foreground text-center">
              <History className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
              Nenhuma transação parecida encontrada. Escolha manualmente abaixo.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Encontrado no seu histórico:
              </div>
              {sugestoes.map((s) => {
                const isSel = selecionada === s.categoria_financeira_id;
                return (
                  <button
                    key={s.categoria_financeira_id}
                    type="button"
                    onClick={() => setSelecionada(s.categoria_financeira_id)}
                    className={`w-full text-left rounded-md border p-3 transition-all ${
                      isSel
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/40 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm font-medium text-foreground">
                        {s.categoria_nome}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {s.exact_count > 0 && (
                          <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                            {s.exact_count} idêntica{s.exact_count !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {s.similar_count > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {s.similar_count} similar{s.similar_count !== 1 ? "es" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {s.sample_descriptions && s.sample_descriptions.length > 0 && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        Ex: {s.sample_descriptions.slice(0, 2).join(" · ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Seletor manual (sempre visível) */}
          <div className="space-y-1.5 pt-2 border-t border-border/30">
            <Label className="text-xs">Subcategoria selecionada</Label>
            <Select
              value={selecionada ?? "_none"}
              onValueChange={(v) => setSelecionada(v === "_none" ? null : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhuma —</SelectItem>
                {categorias.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CTA criar regra automática */}
          {podeCriarRegra && selecionada && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-foreground">
                    Encontramos <strong className="text-primary">{top!.match_count}</strong>{" "}
                    transações parecidas. Quer criar uma{" "}
                    <strong>regra automática</strong> para classificar todas as próximas com{" "}
                    <strong>"{top!.common_term}"</strong>?
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full text-xs gap-1.5 border-primary/30 hover:bg-primary/10"
                onClick={handleCriarRegra}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Criar regra automática
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Agora não
            </Button>
            <Button onClick={() => onApply(selecionada)} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
                </>
              ) : (
                "Aplicar e salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal stack: criar regra automática */}
      {regraSeed && (
        <CriarRegraAutoModal
          open={criarRegraOpen}
          onOpenChange={setCriarRegraOpen}
          initialTerm={regraSeed.termo}
          initialCategoriaId={regraSeed.catId}
          tipoSugerido={tipoSugerido}
        />
      )}
    </>
  );
}
