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
  FolderTree, TrendingUp, TrendingDown, Minus, RefreshCw, GripVertical,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type TipoFinanceiro = "receita" | "despesa" | "custo" | "ajuste";

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
  receita: "Receita", despesa: "Despesa", custo: "Custo", ajuste: "Ajuste",
};

const tipoColors: Record<TipoFinanceiro, string> = {
  receita: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  despesa: "bg-red-500/10 text-red-400 border-red-500/20",
  custo: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ajuste: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const tipoIcons: Record<TipoFinanceiro, typeof TrendingUp> = {
  receita: TrendingUp, despesa: TrendingDown, custo: Minus, ajuste: RefreshCw,
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
    mutationFn: async (updates: { id: string; ordem: number }[]) => {
      await Promise.all(updates.map(({ id, ordem }) => supabase.from("categorias_financeiras").update({ ordem }).eq("id", id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }),
    onError: () => toast.error("Erro ao reordenar"),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const sourceItem = visibleItems[result.source.index];
    const destItem = visibleItems[result.destination.index];
    if (sourceItem.parentId !== destItem.parentId) { toast.error("Arraste apenas entre categorias do mesmo nível. Use 'Mover para' no menu."); return; }
    const parentId = sourceItem.parentId;
    const siblings = categorias.filter((c) => c.categoria_pai_id === parentId).sort((a, b) => a.ordem - b.ordem);
    const srcIdx = siblings.findIndex((s) => s.id === sourceItem.id);
    const destIdx = siblings.findIndex((s) => s.id === destItem.id);
    if (srcIdx === -1 || destIdx === -1) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(destIdx, 0, moved);
    reorderMutation.mutate(reordered.map((item, i) => ({ id: item.id, ordem: i })));
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

  // Helper to get all descendant IDs to prevent circular moves
  const getDescendantIds = (id: string): string[] => {
    const children = categorias.filter((c) => c.categoria_pai_id === id);
    return children.flatMap((c) => [c.id, ...getDescendantIds(c.id)]);
  };

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
            <p className="text-[11px] text-muted-foreground mt-0.5">Arraste para reordenar</p>
          </div>
        </div>
        <Button onClick={() => openNew()} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Nova
        </Button>
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
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="custo">Custo</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
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
    </Card>
  );
}
