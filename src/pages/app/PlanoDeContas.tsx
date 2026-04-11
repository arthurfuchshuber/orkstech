import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  FolderTree, TrendingUp, TrendingDown, Minus, RefreshCw,
} from "lucide-react";

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
  receita: "Receita",
  despesa: "Despesa",
  custo: "Custo",
  ajuste: "Ajuste",
};

const tipoColors: Record<TipoFinanceiro, string> = {
  receita: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  despesa: "bg-red-500/10 text-red-400 border-red-500/20",
  custo: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ajuste: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const tipoIcons: Record<TipoFinanceiro, typeof TrendingUp> = {
  receita: TrendingUp,
  despesa: TrendingDown,
  custo: Minus,
  ajuste: RefreshCw,
};

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

interface TreeNodeProps {
  node: Categoria;
  level: number;
  onEdit: (c: Categoria) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, ativo: boolean) => void;
  onAddChild: (parentId: string, tipo: TipoFinanceiro) => void;
}

function TreeNode({ node, level, onEdit, onDelete, onToggle, onAddChild }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = tipoIcons[node.tipo];

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group ${
          !node.ativo ? "opacity-50" : ""
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
        >
          {hasChildren ? (
            open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
          )}
        </button>

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{node.nome}</span>

        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tipoColors[node.tipo]}`}>
          {tipoLabels[node.tipo]}
        </Badge>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(node.id, node.tipo)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(node.id, !node.ativo)}>
            <Power className={`w-3.5 h-3.5 ${node.ativo ? "text-emerald-400" : "text-muted-foreground"}`} />
          </Button>
          {!hasChildren && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {open && hasChildren && node.children!.map((child) => (
        <TreeNode key={child.id} node={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

export default function PlanoDeContas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "receita" as TipoFinanceiro, categoria_pai_id: null as string | null, ordem: 0 });

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("user_id", user!.id)
        .order("ordem");
      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !!user,
  });

  const tree = buildTree(categorias);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("categorias_financeiras")
          .update({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id, ordem: form.ordem })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categorias_financeiras")
          .insert({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id, ordem: form.ordem, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success(editingId ? "Categoria atualizada" : "Categoria criada");
      closeModal();
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias_financeiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria excluída");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("categorias_financeiras").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias_financeiras"] }),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ nome: "", tipo: "receita", categoria_pai_id: null, ordem: 0 });
  };

  const openNew = (parentId?: string, tipo?: TipoFinanceiro) => {
    setEditingId(null);
    setForm({ nome: "", tipo: tipo || "receita", categoria_pai_id: parentId || null, ordem: categorias.length });
    setModalOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setEditingId(c.id);
    setForm({ nome: c.nome, tipo: c.tipo, categoria_pai_id: c.categoria_pai_id, ordem: c.ordem });
    setModalOpen(true);
  };

  const parentOptions = categorias.filter((c) => c.id !== editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderTree className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Plano de Contas</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas categorias financeiras</p>
          </div>
        </div>
        <Button onClick={() => openNew()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma categoria cadastrada. Crie sua primeira categoria para começar.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                onEdit={openEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onToggle={(id, ativo) => toggleMutation.mutate({ id, ativo })}
                onAddChild={(parentId, tipo) => openNew(parentId, tipo)}
              />
            ))}
          </div>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
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
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ordem de Exibição</label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })} />
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
    </div>
  );
}
