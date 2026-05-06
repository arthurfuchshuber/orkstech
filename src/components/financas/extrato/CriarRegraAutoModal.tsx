import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Wand2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Texto base extraído do histórico (ex: "UBER") */
  initialTerm: string;
  /** Categoria sugerida pré-preenchida */
  initialCategoriaId: string;
  /** "pagar" | "receber" — direção da transação que originou a sugestão */
  tipoSugerido: "pagar" | "receber";
  /** Callback após salvar com sucesso (para abrir aplicação retroativa, etc.) */
  onSaved?: (regraId: string) => void;
}

/**
 * Modal "Criar regra automática" — abre por cima do modal de Sugestão.
 * Mostra a regra pré-preenchida com base no termo comum e categoria escolhida,
 * permite editar antes de salvar, e mostra preview de impacto em tempo real.
 */
export function CriarRegraAutoModal({
  open,
  onOpenChange,
  initialTerm,
  initialCategoriaId,
  tipoSugerido,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const empresaId = empresa?.id ?? null;
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [termo, setTermo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [aplicarEm, setAplicarEm] = useState<"pagar" | "receber" | "ambos">("ambos");
  const [escopo, setEscopo] = useState<"persistir" | "visualizacao">("persistir");
  const [ativarRetroativo, setAtivarRetroativo] = useState(true);

  // Pré-preenche quando abre
  useEffect(() => {
    if (open) {
      const t = (initialTerm || "").trim();
      setTermo(t);
      setCategoriaId(initialCategoriaId);
      setAplicarEm(tipoSugerido);
      setEscopo("persistir");
      setAtivarRetroativo(true);
      // nome inteligente
      setNome(t ? `Auto: ${t.toUpperCase()} → categoria` : "Nova regra automática");
    }
  }, [open, initialTerm, initialCategoriaId, tipoSugerido]);

  // categorias (folhas)
  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-regras-cats-auto", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, categoria_pai_id, tipo")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []).filter((c: any) => c.categoria_pai_id != null);
    },
  });

  const [catModal, setCatModal] = useState<{ open: boolean; editingId?: string }>({ open: false });

  const categoriasFiltradas = useMemo(() => {
    if (aplicarEm === "receber") return categorias.filter((c: any) => c.tipo === "receita");
    if (aplicarEm === "pagar")
      return categorias.filter(
        (c: any) =>
          c.tipo === "despesa" ||
          c.tipo === "custo" ||
          c.tipo === "distribuicao_lucros" ||
          c.tipo === "imposto" ||
          c.tipo === "investimento"
      );
    return categorias;
  }, [categorias, aplicarEm]);

  // Limpa categoria se sair do escopo do tipo
  useEffect(() => {
    if (categoriaId && !categoriasFiltradas.find((c: any) => c.id === categoriaId)) {
      setCategoriaId("");
    }
  }, [categoriasFiltradas, categoriaId]);

  // Atualiza nome ao trocar categoria
  useEffect(() => {
    const cat = categorias.find((c: any) => c.id === categoriaId);
    if (cat && termo) {
      setNome(`Auto: ${termo.toUpperCase()} → ${cat.nome}`);
    }
  }, [categoriaId, termo, categorias]);

  const condicoes = useMemo(
    () => [{ campo: "description", operador: "contains", valor: termo.trim() }],
    [termo]
  );

  // Verifica se já existe regra parecida (mesmo termo)
  // Retorna { exata } quando bate termo + mesma categoria, ou { conflito } quando termo igual mas categoria diferente
  const { data: regraMatch } = useQuery({
    queryKey: ["dre-regra-match", targetUserId, termo, categoriaId],
    enabled: !!targetUserId && open && termo.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("dre_regras" as any)
        .select("id, nome, condicoes, categoria_destino_id")
        .eq("user_id", targetUserId!)
        .eq("ativo", true);
      const t = termo.trim().toLowerCase();
      const matches = (data as any[] | null)?.filter((r) => {
        const conds = Array.isArray(r.condicoes) ? r.condicoes : [];
        return conds.some(
          (c: any) =>
            c.campo === "description" &&
            (c.operador === "contains" || c.operador === "equals") &&
            String(c.valor || "").trim().toLowerCase() === t
        );
      }) ?? [];
      const exata = matches.find((r) => r.categoria_destino_id === categoriaId) ?? null;
      const conflito = !exata ? matches[0] ?? null : null;
      return { exata, conflito };
    },
  });

  const regraExistente = regraMatch?.exata ?? null;
  const regraConflito = regraMatch?.conflito ?? null;

  // Preview de impacto
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ["preview-regra", targetUserId, empresaId, termo, categoriaId, aplicarEm],
    enabled:
      !!targetUserId && open && termo.trim().length >= 2 && !!categoriaId && !regraExistente && !regraConflito,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_regra_dre" as any, {
        p_user_id: targetUserId,
        p_empresa_id: empresaId,
        p_condicoes: condicoes,
        p_condicao_logica: "AND",
        p_categoria_destino_id: categoriaId,
        p_aplicar_em: aplicarEm,
      });
      if (error) throw error;
      return data as {
        pagar: number;
        receber: number;
        extrato: number;
        total: number;
      };
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error("Sem usuário");
      const { data, error } = await supabase
        .from("dre_regras" as any)
        .insert({
          user_id: targetUserId,
          empresa_id: empresaId,
          nome: nome.trim() || `Auto: ${termo}`,
          ativo: true,
          ordem: 9999,
          escopo,
          condicoes,
          condicao_logica: "AND",
          categoria_destino_id: categoriaId,
          aplicar_em: aplicarEm,
        })
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as any).id as string;

      // Aplicar retroativo se marcado
      if (ativarRetroativo && escopo === "persistir") {
        const { error: rpcErr } = await supabase.rpc("aplicar_regras_retroativo" as any, {
          p_user_id: targetUserId,
        });
        if (rpcErr) console.warn("Falha ao aplicar retroativo:", rpcErr.message);
      }
      return newId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["dre-regras"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      qc.invalidateQueries({ queryKey: ["dre-transactions"] });
      qc.invalidateQueries({ queryKey: ["sugestoes-categoria"] });
      toast.success(
        ativarRetroativo
          ? "Regra criada e aplicada ao histórico"
          : "Regra criada"
      );
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar regra"),
  });

  const totalImpacto = preview?.total ?? 0;
  const canSave =
    !!termo.trim() &&
    !!categoriaId &&
    !!nome.trim() &&
    !regraExistente &&
    !regraConflito &&
    !saveMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Criar regra automática
          </DialogTitle>
          <DialogDescription>
            A partir de agora, transações com este padrão serão classificadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aviso de regra idêntica */}
          {regraExistente && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <strong className="text-amber-500">Já existe uma regra idêntica:</strong>{" "}
              <span className="text-foreground">"{(regraExistente as any).nome}"</span>. Edite o
              termo abaixo ou cancele.
            </div>
          )}

          {/* Aviso de conflito (mesmo termo apontando para outra categoria) */}
          {regraConflito && !regraExistente && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1">
              <strong className="text-destructive">Conflito de regra:</strong>{" "}
              <span className="text-foreground">
                já existe a regra "{(regraConflito as any).nome}" usando este mesmo termo, mas
                apontando para outra categoria.
              </span>
              <p className="text-muted-foreground">
                Edite o termo, troque a categoria de destino, ou ajuste a regra anterior em
                DRE & Analytics → Regras.
              </p>
            </div>
          )}

          {/* Frase visual da regra */}
          <div className="rounded-md bg-muted/40 border border-border/40 p-3 text-xs leading-relaxed">
            <span className="text-muted-foreground">SE</span>{" "}
            <span className="text-foreground font-medium">descrição contém</span>{" "}
            <span className="text-primary font-mono">"{termo || "..."}"</span>
            <br />
            <span className="text-muted-foreground">ENTÃO classificar como</span>{" "}
            <span className="text-foreground font-medium">
              {categorias.find((c: any) => c.id === categoriaId)?.nome ?? "—"}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Termo a procurar na descrição</Label>
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              maxLength={60}
              placeholder='Ex: "UBER", "POSTO", "TIM"'
              className="h-9 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Aplicar em</Label>
            <Select value={aplicarEm} onValueChange={(v: any) => setAplicarEm(v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Saídas e Entradas</SelectItem>
                <SelectItem value="pagar">Apenas Saídas (Pagar)</SelectItem>
                <SelectItem value="receber">Apenas Entradas (Receber)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ManagedSelectInput
            label="Categorizar como"
            value={categoriaId}
            onValueChange={setCategoriaId}
            placeholder="Selecionar categoria"
            options={categoriasFiltradas.map((c: any) => ({ value: c.id, label: c.nome }))}
            addLabel="Nova categoria"
            onAddModal={() => setCatModal({ open: true })}
            onEditModal={(id) => setCatModal({ open: true, editingId: id })}
          />

          <div className="space-y-1.5">
            <Label className="text-xs">Nome da regra</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
              className="h-9 text-sm"
            />
          </div>

          {/* Preview de impacto */}
          {!regraExistente && !regraConflito && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                Impacto no histórico
                {previewLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              {preview ? (
                totalImpacto > 0 ? (
                  <>
                    <p className="text-xs text-foreground">
                      Esta regra vai categorizar{" "}
                      <strong className="text-primary">{totalImpacto}</strong> lançamento
                      {totalImpacto !== 1 ? "s" : ""} já existente
                      {totalImpacto !== 1 ? "s" : ""}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.pagar > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {preview.pagar} a pagar
                        </Badge>
                      )}
                      {preview.receber > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {preview.receber} a receber
                        </Badge>
                      )}
                      {preview.extrato > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {preview.extrato} no extrato
                        </Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum lançamento existente bate com essa regra. Ela só vai categorizar futuros.
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Calculando impacto...</p>
              )}

              {totalImpacto > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="retroativo" className="text-xs cursor-pointer">
                    Aplicar agora ao histórico
                  </Label>
                  <Switch
                    id="retroativo"
                    checked={ativarRetroativo}
                    onCheckedChange={setAtivarRetroativo}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={!canSave}>
            {saveMut.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
              </>
            ) : (
              "Criar regra"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CategoriaFinanceiraModal
        open={catModal.open}
        onOpenChange={(v) => setCatModal({ open: v, editingId: catModal.editingId })}
        editingId={catModal.editingId}
        defaultTipo={aplicarEm === "receber" ? "receita" : "despesa"}
        onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ["dre-regras-cats-auto"] });
          if (id) setCategoriaId(id);
          setCatModal({ open: false });
        }}
      />
    </Dialog>
  );
}
