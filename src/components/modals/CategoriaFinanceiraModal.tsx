import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useDRE } from "@/hooks/useDRE";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, BarChart3, Eye } from "lucide-react";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";

type TipoFinanceiro = "receita" | "despesa" | "custo" | "deducao" | "imposto" | "receita_financeira" | "despesa_financeira" | "distribuicao_lucros" | "ajuste";

const tipoLabels: Record<TipoFinanceiro, string> = {
  receita: "Receita", deducao: "Dedução", custo: "Custo", despesa: "Despesa",
  receita_financeira: "Rec. Financeira", despesa_financeira: "Desp. Financeira",
  imposto: "Imposto", distribuicao_lucros: "Distribuição de Lucros", ajuste: "Ajuste",
};

const tipoColors: Record<TipoFinanceiro, string> = {
  receita: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  deducao: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  custo: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  despesa: "bg-red-500/10 text-red-400 border-red-500/20",
  receita_financeira: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  despesa_financeira: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  imposto: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  distribuicao_lucros: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  ajuste: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface CategoriaFinanceiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  defaultTipo?: string;
  onSaved?: (id: string) => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Popover de prévia do DRE — simula a inclusão da categoria/subcategoria sem persistir */
function DREPreviewPopover({
  simNome,
  simTipo,
  simParentId,
  parentName,
}: {
  simNome: string;
  simTipo: TipoFinanceiro;
  simParentId: string | null;
  parentName?: string;
}) {
  const { lines, isLoading } = useDRE({ period: "this_month" });

  const simulatedLines = useMemo(() => {
    if (!lines?.length) return [];
    // Marca onde a nova categoria entraria — se tem pai, abaixo da pai; senão como raiz no fim do bloco do tipo
    const nome = simNome.trim() || "(nova categoria)";
    const placeholder = {
      id: "__sim__",
      label: `+ ${nome}`,
      depth: simParentId ? 1 : 0,
      amount: 0,
      percentage: 0,
      previousAmount: 0,
      variation: null,
      isGroup: false,
      isSummary: false,
      tipo: simTipo,
      number: "novo",
      isSimulated: true,
    };
    if (simParentId) {
      const idx = lines.findIndex((l) => l.id === simParentId);
      if (idx >= 0) {
        const out = [...lines];
        out.splice(idx + 1, 0, placeholder as any);
        return out;
      }
    }
    // Sem pai: adiciona logo após o último root do mesmo tipo
    const lastIdx = (() => {
      let last = -1;
      lines.forEach((l, i) => { if (l.depth === 0 && l.tipo === simTipo) last = i; });
      return last;
    })();
    if (lastIdx >= 0) {
      const out = [...lines];
      out.splice(lastIdx + 1, 0, placeholder as any);
      return out;
    }
    return [placeholder as any, ...lines];
  }, [lines, simNome, simTipo, simParentId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Eye className="h-3.5 w-3.5" />
          Prévia DRE
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-[480px] p-0 border-border/60 bg-card shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Simulação do DRE</div>
            <div className="text-[11px] text-muted-foreground">
              Mês atual · prévia da {simParentId ? "subcategoria" : "categoria"}{parentName ? ` em "${parentName}"` : ""}
            </div>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          <div className="px-3 py-2">
            {isLoading ? (
              <div className="text-xs text-muted-foreground p-4 text-center">Carregando DRE...</div>
            ) : (
              <div className="space-y-0.5">
                {simulatedLines.map((l: any) => {
                  const isSim = l.isSimulated;
                  const isSummary = l.label?.startsWith("(=)") || l.label?.startsWith("(%)") || l.label?.startsWith("(+/-)") || l.label?.startsWith("(-)");
                  return (
                    <div
                      key={l.id}
                      style={{ paddingLeft: `${(l.depth || 0) * 14 + 8}px` }}
                      className={[
                        "flex items-center justify-between gap-3 py-1 px-1 rounded text-xs",
                        isSim ? "bg-primary/15 border border-primary/30 text-primary font-semibold" : "",
                        isSummary && !isSim ? "border-t border-border/30 mt-1 pt-1.5 font-medium" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {l.number && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{l.number}</span>}
                        <span className="truncate">{l.label}</span>
                        {isSim && (
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ml-1 ${tipoColors[simTipo]}`}>
                            {tipoLabels[simTipo]}
                          </Badge>
                        )}
                      </div>
                      <span className="tabular-nums shrink-0">
                        {l.isPercentual ? `${(l.amount || 0).toFixed(1)}%` : fmtBRL(Number(l.amount || 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="px-4 py-2 border-t border-border/40 text-[10px] text-muted-foreground">
          A nova linha aparece destacada. Os valores serão preenchidos conforme lançamentos forem classificados nela.
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Sub-modal interno para criar uma nova categoria PAI (raiz) com seletor de tipo */
function NewParentCategoryModal({
  open,
  onOpenChange,
  defaultTipo,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultTipo: TipoFinanceiro;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoFinanceiro>(defaultTipo);

  useEffect(() => {
    if (open) {
      setNome("");
      setTipo(defaultTipo);
    }
  }, [open, defaultTipo]);

  const createParent = useMutation({
    mutationFn: async () => {
      const { data: siblings } = await supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("user_id", targetUserId!)
        .is("categoria_pai_id", null);
      const ordem = (siblings ?? []).length;
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert({
          nome: nome.trim(),
          tipo: tipo as any,
          categoria_pai_id: null,
          ordem,
          user_id: targetUserId!,
          empresa_id: empresa?.id || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      qc.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      qc.invalidateQueries({ queryKey: ["dre-categorias"] });
      toast.success("Categoria pai criada");
      onCreated(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao criar categoria pai"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Nova Categoria Pai
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Receitas Operacionais"
              maxLength={60}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo (DRE)</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFinanceiro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(tipoLabels) as TipoFinanceiro[]).map((t) => (
                  <SelectItem key={t} value={t}>{tipoLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createParent.mutate()}
            disabled={!nome.trim() || createParent.isPending}
          >
            {createParent.isPending ? "Criando..." : "Criar Categoria Pai"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriaFinanceiraModal({ open, onOpenChange, editingId, defaultTipo = "despesa", onSaved }: CategoriaFinanceiraModalProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: "",
    categoria_pai_id: null as string | null,
    tipo: defaultTipo as TipoFinanceiro,
  });
  const [parentModalOpen, setParentModalOpen] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["categorias_financeiras_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_financeiras").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categorias_financeiras", targetUserId],
    enabled: open && !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_financeiras").select("*").eq("user_id", targetUserId!).order("ordem");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({
        nome: existing.nome,
        categoria_pai_id: existing.categoria_pai_id,
        tipo: (existing.tipo as TipoFinanceiro) ?? (defaultTipo as TipoFinanceiro),
      });
    } else if (!editingId && open) {
      setForm({ nome: "", categoria_pai_id: null, tipo: defaultTipo as TipoFinanceiro });
    }
  }, [existing, editingId, open, defaultTipo]);

  const parentOptions = allCategories.filter((c) => c.id !== editingId);
  const selectedParent = allCategories.find((c) => c.id === form.categoria_pai_id);
  // Tipo: por padrão herda da pai, mas o usuário pode override-ar pelo seletor.
  const effectiveTipo = form.tipo as TipoFinanceiro;

  // Quando troca a pai e o usuário ainda não tocou no tipo, sincroniza com o tipo herdado.
  useEffect(() => {
    if (selectedParent?.tipo) {
      setForm((f) => ({ ...f, tipo: selectedParent.tipo as TipoFinanceiro }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParent?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("categorias_financeiras")
          .update({
            nome: form.nome,
            categoria_pai_id: form.categoria_pai_id,
            // só persiste tipo quando é raiz (sem pai)
            ...(form.categoria_pai_id ? {} : { tipo: form.tipo as any }),
          })
          .eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const siblings = allCategories.filter((c) => c.categoria_pai_id === form.categoria_pai_id);
        const ordem = siblings.length;
        const { data, error } = await supabase.from("categorias_financeiras")
          .insert({
            nome: form.nome,
            tipo: effectiveTipo as any,
            categoria_pai_id: form.categoria_pai_id,
            ordem,
            user_id: targetUserId!,
            empresa_id: empresa?.id || null,
          })
          .select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      qc.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      qc.invalidateQueries({ queryKey: ["dre-categorias"] });
      toast.success(editingId ? "Categoria atualizada" : "Categoria criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const NEW_PARENT_VALUE = "__new_parent__";

  const tipoOptions = (Object.keys(tipoLabels) as TipoFinanceiro[]).map((t) => ({
    value: t,
    label: tipoLabels[t],
  }));

  const parentManagedOptions = [
    { value: "__none__", label: "Nenhuma (raiz)" },
    ...parentOptions.map((c) => ({
      value: c.id,
      label: c.nome,
      tooltip: tipoLabels[c.tipo as TipoFinanceiro],
    })),
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Receita de Serviços"
                maxLength={60}
                autoFocus
              />
            </div>
            <div>
              <ManagedSelectInput
                label="Categoria Pai (opcional)"
                value={form.categoria_pai_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, categoria_pai_id: v === "__none__" ? null : v })
                }
                placeholder="Nenhuma (raiz)"
                options={parentManagedOptions}
                addLabel="Criar nova categoria pai…"
                onAddModal={() => setParentModalOpen(true)}
              />
              {selectedParent ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Tipo herdado:</span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${tipoColors[effectiveTipo]}`}>
                    {tipoLabels[effectiveTipo]}
                  </Badge>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Sem categoria pai = será uma categoria <strong>raiz</strong>. Defina o tipo abaixo.
                </p>
              )}
            </div>
            {!selectedParent && (
              <div>
                <ManagedSelectInput
                  label="Tipo (DRE)"
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v as TipoFinanceiro })}
                  placeholder="Selecione o tipo"
                  options={tipoOptions}
                />
                <div className="mt-1.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${tipoColors[form.tipo]}`}>
                    {tipoLabels[form.tipo]}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <DREPreviewPopover
              simNome={form.nome}
              simTipo={effectiveTipo}
              simParentId={form.categoria_pai_id}
              parentName={selectedParent?.nome}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewParentCategoryModal
        open={parentModalOpen}
        onOpenChange={setParentModalOpen}
        defaultTipo={defaultTipo as TipoFinanceiro}
        onCreated={(id) => setForm((f) => ({ ...f, categoria_pai_id: id }))}
      />
    </>
  );
}
