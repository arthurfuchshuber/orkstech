import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Power,
  FolderTree, TrendingUp, TrendingDown, Minus, RefreshCw, GripVertical, MoveRight, Eye,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type TipoFinanceiro = "receita" | "despesa" | "custo" | "deducao" | "imposto" | "receita_financeira" | "despesa_financeira" | "distribuicao_lucros" | "ajuste";

interface Categoria {
  id: string;
  nome: string;
  tipo: TipoFinanceiro;
  categoria_pai_id: string | null;
  ordem: number;
  ativo: boolean;
  children?: Categoria[];
}

const tipoLabels: Record<TipoFinanceiro, string> = {
  receita: "Receita", deducao: "Dedução", custo: "Custo", despesa: "Despesa",
  receita_financeira: "Rec. Financeira", despesa_financeira: "Desp. Financeira",
  imposto: "Imposto", distribuicao_lucros: "Distribuição de Lucros", ajuste: "Ajuste",
};

const tipoDescriptions: Record<TipoFinanceiro, string> = {
  receita: "Entradas operacionais do negócio, como vendas de produtos ou prestação de serviços.",
  deducao: "Valores descontados da receita bruta, como impostos sobre vendas (ISS, ICMS) e devoluções.",
  custo: "Gastos diretamente ligados à produção ou entrega do serviço/produto (ex: matéria-prima, mão de obra direta).",
  despesa: "Gastos operacionais para manter a empresa funcionando (ex: aluguel, salários administrativos, marketing).",
  receita_financeira: "Ganhos financeiros como rendimentos de aplicações, juros recebidos e descontos obtidos.",
  despesa_financeira: "Gastos financeiros como juros de empréstimos, tarifas bancárias e multas.",
  imposto: "Tributos sobre o lucro da empresa, como Imposto de Renda (IRPJ) e Contribuição Social (CSLL).",
  distribuicao_lucros: "Distribuição de lucros/dividendos aos sócios. Aparece após o Lucro Líquido (não impacta EBITDA nem Lucro Líquido).",
  ajuste: "Lançamentos de correção ou reclassificação contábil que não se encaixam nas categorias acima.",
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

const tipoIcons: Record<TipoFinanceiro, typeof TrendingUp> = {
  receita: TrendingUp, deducao: Minus, custo: Minus, despesa: TrendingDown,
  receita_financeira: TrendingUp, despesa_financeira: TrendingDown,
  imposto: Minus, distribuicao_lucros: TrendingDown, ajuste: RefreshCw,
};

function flattenTree(nodes: Categoria[]): { id: string; node: Categoria; level: number; parentId: string | null; number: string }[] {
  const result: { id: string; node: Categoria; level: number; parentId: string | null; number: string }[] = [];
  function walk(items: Categoria[], lvl: number, pid: string | null, prefix: string) {
    items.forEach((n, idx) => {
      const num = prefix ? `${prefix}${idx + 1}.` : `${idx + 1}.`;
      result.push({ id: n.id, node: n, level: lvl, parentId: pid, number: num });
      if (n.children?.length) walk(n.children, lvl + 1, n.id, num);
    });
  }
  walk(nodes, 0, null, "");
  return result;
}

function buildTree(items: Categoria[]): Categoria[] {
  const map = new Map<string, Categoria>();
  const roots: Categoria[] = [];
  items.forEach((i) => map.set(i.id, { ...i, children: [] }));
  items.forEach((i) => {
    const node = map.get(i.id)!;
    if (i.categoria_pai_id && map.has(i.categoria_pai_id)) {
      map.get(i.categoria_pai_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: Categoria[]) => {
    nodes.sort((a, b) => a.ordem - b.ordem);
    nodes.forEach((n) => n.children && sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export function PlanoDeContasSection() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "receita" as TipoFinanceiro, categoria_pai_id: null as string | null });
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movingNode, setMovingNode] = useState<Categoria | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias_financeiras", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_financeiras").select("*").eq("user_id", targetUserId!).order("ordem");
      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !!user && !!targetUserId,
  });

  const tree = buildTree(categorias);
  const flatItems = flattenTree(tree);

  const visibleItems = flatItems.filter((item) => {
    let current = item.parentId;
    while (current) {
      if (collapsedIds.has(current)) return false;
      const parent = flatItems.find((f) => f.id === current);
      current = parent?.parentId ?? null;
    }
    return true;
  });

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; ordem: number; categoria_pai_id?: string | null }[]) => {
      await Promise.all(updates.map(({ id, ordem, categoria_pai_id }) => {
        const payload: any = { ordem };
        if (categoria_pai_id !== undefined) payload.categoria_pai_id = categoria_pai_id;
        return supabase.from("categorias_financeiras").update(payload).eq("id", id);
      }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }),
    onError: () => toast.error("Erro ao reordenar"),
  });

  // Helper to get all descendant IDs to prevent circular moves
  const getDescendantIds = (id: string): string[] => {
    const children = categorias.filter((c) => c.categoria_pai_id === id);
    return children.flatMap((c) => [c.id, ...getDescendantIds(c.id)]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const sourceItem = visibleItems[result.source.index];
    const destItem = visibleItems[result.destination.index];

    // Prevent circular: can't drop into own descendants
    const descendantIds = getDescendantIds(sourceItem.id);
    if (destItem.id === sourceItem.id || descendantIds.includes(destItem.id)) {
      toast.error("Não é possível mover para dentro de si mesmo");
      return;
    }

    if (sourceItem.parentId === destItem.parentId) {
      // Same level: simple reorder
      const parentId = sourceItem.parentId;
      const siblings = categorias.filter((c) => c.categoria_pai_id === parentId).sort((a, b) => a.ordem - b.ordem);
      const srcIdx = siblings.findIndex((s) => s.id === sourceItem.id);
      const destIdx = siblings.findIndex((s) => s.id === destItem.id);
      if (srcIdx === -1 || destIdx === -1) return;
      const reordered = [...siblings];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);
      reorderMutation.mutate(reordered.map((item, i) => ({ id: item.id, ordem: i })));
    } else {
      // Cross-level: make source a CHILD of the destination item
      const newParentId = destItem.id;

      // Remove from old siblings and reorder them
      const oldSiblings = categorias
        .filter((c) => c.categoria_pai_id === sourceItem.parentId && c.id !== sourceItem.id)
        .sort((a, b) => a.ordem - b.ordem);
      const oldUpdates = oldSiblings.map((item, i) => ({ id: item.id, ordem: i }));

      // Add as last child of the destination
      const newSiblings = categorias
        .filter((c) => c.categoria_pai_id === newParentId)
        .sort((a, b) => a.ordem - b.ordem);

      const newUpdates = [
        ...newSiblings.map((item, i) => ({ id: item.id, ordem: i })),
        { id: sourceItem.id, ordem: newSiblings.length, categoria_pai_id: newParentId as string | null },
      ];

      reorderMutation.mutate([...oldUpdates, ...newUpdates]);

      // Expand the destination so the user sees the moved item
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(newParentId);
        return next;
      });

      toast.success(`"${sourceItem.node.nome}" agora é sub de "${destItem.node.nome}"`);
    }
  };

  // To promote (move OUT), use "Mover para" in dropdown or drag onto a root-level sibling
  const handlePromoteToRoot = (node: Categoria) => {
    const oldSiblings = categorias
      .filter((c) => c.categoria_pai_id === node.categoria_pai_id && c.id !== node.id)
      .sort((a, b) => a.ordem - b.ordem);
    const oldUpdates = oldSiblings.map((item, i) => ({ id: item.id, ordem: i }));
    const rootSiblings = categorias.filter((c) => !c.categoria_pai_id).sort((a, b) => a.ordem - b.ordem);
    reorderMutation.mutate([
      ...oldUpdates,
      { id: node.id, ordem: rootSiblings.length, categoria_pai_id: null },
    ]);
    toast.success(`"${node.nome}" promovida para raiz`);
  };

  const moveMutation = useMutation({
    mutationFn: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
      const siblings = categorias.filter((c) => c.categoria_pai_id === newParentId && c.id !== id);
      const { error } = await supabase.from("categorias_financeiras").update({ categoria_pai_id: newParentId, ordem: siblings.length }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }); toast.success("Categoria movida"); closeMoveModal(); },
    onError: () => toast.error("Erro ao mover categoria"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("categorias_financeiras").update({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id }).eq("id", editingId);
        if (error) throw error;
      } else {
        const siblings = categorias.filter((c) => c.categoria_pai_id === form.categoria_pai_id);
        const { error } = await supabase.from("categorias_financeiras").insert({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id, ordem: siblings.length, user_id: targetUserId!, empresa_id: empresa?.id || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }); toast.success(editingId ? "Categoria atualizada" : "Categoria criada"); closeModal(); },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categorias_financeiras").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }); toast.success("Categoria excluída"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => { const { error } = await supabase.from("categorias_financeiras").update({ ativo }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }),
  });

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm({ nome: "", tipo: "receita", categoria_pai_id: null }); };
  const openNew = (parentId?: string, tipo?: TipoFinanceiro) => { setEditingId(null); setForm({ nome: "", tipo: tipo || "receita", categoria_pai_id: parentId || null }); setModalOpen(true); };
  const openEdit = (c: Categoria) => { setEditingId(c.id); setForm({ nome: c.nome, tipo: c.tipo, categoria_pai_id: c.categoria_pai_id }); setModalOpen(true); };

  const closeMoveModal = () => { setMoveModalOpen(false); setMovingNode(null); setMoveTargetId(null); };
  const openMoveModal = (c: Categoria) => { setMovingNode(c); setMoveTargetId(c.categoria_pai_id); setMoveModalOpen(true); };


  const moveParentOptions = movingNode
    ? categorias.filter((c) => c.id !== movingNode.id && !getDescendantIds(movingNode.id).includes(c.id))
    : [];

  const parentOptions = categorias.filter((c) => c.id !== editingId);

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderTree className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Plano de Contas</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Arraste para reordenar ou mover entre níveis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPreviewOpen(true)} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md" title="Pré-visualizar DRE com base na estrutura">
            <Eye className="w-3 h-3" /> Prévia DRE
          </Button>
          <Button onClick={() => openNew()} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
            <Plus className="w-3 h-3" /> Nova
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : tree.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Nenhuma categoria cadastrada.</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="plano-de-contas">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {visibleItems.map((item, index) => {
                    const node = item.node;
                    const hasChildren = node.children && node.children.length > 0;
                    const isCollapsed = collapsedIds.has(node.id);
                    const Icon = tipoIcons[node.tipo];
                    return (
                      <Draggable key={node.id} draggableId={node.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef} {...provided.draggableProps}
                            className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md transition-colors group ${!node.ativo ? "opacity-40" : ""} ${snapshot.isDragging ? "bg-muted/60 shadow-lg" : "hover:bg-muted/30"}`}
                            style={{ ...provided.draggableProps.style, paddingLeft: `${item.level * 18 + 8}px` }}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0">
                              <GripVertical className="w-3 h-3 text-muted-foreground/30" />
                            </div>
                            <button onClick={() => toggleCollapse(node.id)} className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              {hasChildren ? (isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />) : <div className="w-1 h-1 rounded-full bg-muted-foreground/25" />}
                            </button>
                            <Icon className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                            <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 min-w-[2rem]">{item.number}</span>
                            <span className="text-xs font-medium text-foreground flex-1 truncate">{node.nome}</span>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${tipoColors[node.tipo]}`}>{tipoLabels[node.tipo]}</Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openNew(node.id, node.tipo)}>
                                  <Plus className="w-4 h-4 mr-2" /> Adicionar Sub
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(node)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openMoveModal(node)}>
                                  <MoveRight className="w-4 h-4 mr-2" /> Mover para
                                </DropdownMenuItem>
                                {node.categoria_pai_id && (
                                  <DropdownMenuItem onClick={() => handlePromoteToRoot(node)}>
                                    <ChevronRight className="w-4 h-4 mr-2 rotate-[-90deg]" /> Promover para raiz
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: node.id, ativo: !node.ativo })}>
                                  <Power className={`w-4 h-4 mr-2 ${node.ativo ? "text-emerald-400" : "text-muted-foreground"}`} /> {node.ativo ? "Desativar" : "Ativar"}
                                </DropdownMenuItem>
                                {!hasChildren && (
                                  <DropdownMenuItem onClick={() => deleteMutation.mutate(node.id)} className="text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Receita de Serviços" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo Financeiro</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoFinanceiro })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(tipoLabels) as TipoFinanceiro[]).map((tipo) => (
                    <SelectItem key={tipo} value={tipo} title={tipoDescriptions[tipo]}>
                      {tipoLabels[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria Pai (opcional)</label>
              <Select value={form.categoria_pai_id || "__none__"} onValueChange={(v) => setForm({ ...form, categoria_pai_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                  {parentOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveModalOpen} onOpenChange={(v) => !v && closeMoveModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover "{movingNode?.nome}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Mover para dentro de:</label>
              <Select value={moveTargetId || "__none__"} onValueChange={(v) => setMoveTargetId(v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Raiz (sem pai)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Raiz (sem pai)</SelectItem>
                  {moveParentOptions.map((c) => {
                    const flat = flatItems.find((f) => f.id === c.id);
                    return <SelectItem key={c.id} value={c.id}>{flat?.number || ""} {c.nome}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeMoveModal}>Cancelar</Button>
            <Button onClick={() => movingNode && moveMutation.mutate({ id: movingNode.id, newParentId: moveTargetId })} disabled={moveMutation.isPending}>
              {moveMutation.isPending ? "Movendo..." : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DREPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        tree={tree}
      />
    </Card>
  );
}

// ============ DRE Preview ============
function DREPreviewDialog({ open, onOpenChange, tree }: { open: boolean; onOpenChange: (v: boolean) => void; tree: Categoria[] }) {
  // Group active roots by tipo
  const byTipo = (t: TipoFinanceiro) => tree.filter((n) => n.ativo && n.tipo === t);
  const renderNode = (n: Categoria, depth: number, prefix: string, idx: number): JSX.Element[] => {
    const num = prefix ? `${prefix}${idx + 1}.` : `${idx + 1}.`;
    const lines: JSX.Element[] = [
      <div key={n.id} className="flex items-center gap-2 py-1 text-xs" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="font-mono text-[10px] text-muted-foreground min-w-[2.5rem]">{num}</span>
        <span className="flex-1 text-foreground">{n.nome}</span>
        <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${tipoColors[n.tipo]}`}>{tipoLabels[n.tipo]}</Badge>
      </div>,
    ];
    (n.children ?? []).forEach((c, i) => lines.push(...renderNode(c, depth + 1, num, i)));
    return lines;
  };

  const indicatorRow = (label: string, formula?: string, highlight = false) => (
    <div key={label} className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs border-l-2 ${highlight ? "bg-primary/5 border-primary font-semibold text-foreground" : "bg-muted/20 border-muted-foreground/30 text-foreground/80"}`}>
      <span className="flex-1">{label}</span>
      {formula && <span className="text-[10px] font-mono text-muted-foreground">{formula}</span>}
    </div>
  );

  const section = (title: string, tipo: TipoFinanceiro) => {
    const items = byTipo(tipo);
    if (items.length === 0) return null;
    return (
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mt-2">{title}</div>
        {items.flatMap((n, i) => renderNode(n, 0, "", i))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Prévia da DRE</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualize como sua DRE será estruturada com base no plano de contas atual. Os valores serão preenchidos automaticamente conforme os lançamentos.
          </p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {tree.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma categoria cadastrada ainda. Adicione categorias no Plano de Contas para ver a prévia da DRE.
            </div>
          ) : (
            <>
              {section("Receitas", "receita")}
              {section("(-) Deduções", "deducao")}
              {indicatorRow("(=) Receita Líquida", "Receitas - Deduções", true)}
              {section("(-) Custos", "custo")}
              {indicatorRow("(=) Lucro Bruto", "Receita Líquida - Custos", true)}
              {indicatorRow("(%) Margem Bruta", "Lucro Bruto / Receita")}
              {section("(-) Despesas Operacionais", "despesa")}
              {indicatorRow("(=) Resultado Operacional", "Lucro Bruto - Despesas", true)}
              {indicatorRow("(%) Margem Operacional", "Resultado Op. / Receita")}
              {indicatorRow("(=) EBITDA")}
              {indicatorRow("(%) Margem EBITDA")}
              {section("(+) Receitas Financeiras", "receita_financeira")}
              {section("(-) Despesas Financeiras", "despesa_financeira")}
              {indicatorRow("(+/-) Resultado Financeiro", "Rec. Fin. - Desp. Fin.")}
              {indicatorRow("(=) Resultado antes dos Impostos", "Resultado Op. + Resultado Fin.", true)}
              {section("(-) Impostos", "imposto")}
              {indicatorRow("(=) Lucro Líquido", "Resultado A.I. - Impostos", true)}
              {indicatorRow("(%) Margem Líquida", "Lucro Líquido / Receita")}
              {section("(-) Distribuição de Lucros", "distribuicao_lucros")}
              {indicatorRow("(=) Lucro Retido", "Lucro Líquido - Distribuições", true)}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
