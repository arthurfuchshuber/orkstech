import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoriaCadastroModal } from "@/components/modals/CategoriaCadastroModal";
import { Plus, Pencil, Trash2, Power, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Categoria {
  id: string;
  nome: string;
  categoria_pai_id: string | null;
  ativo: boolean;
  ordem: number;
}

export function CategoriasCadastroSection() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["categorias_cadastro", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_cadastro")
        .select("*")
        .eq("user_id", targetUserId!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
    enabled: !!user && !!targetUserId,
  });

  const parents = items.filter((i) => !i.categoria_pai_id);
  const getChildren = (parentId: string) => items.filter((i) => i.categoria_pai_id === parentId);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias_cadastro").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_cadastro"] });
      toast.success("Categoria excluída");
    },
    onError: () => toast.error("Erro ao excluir categoria"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("categorias_cadastro").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias_cadastro"] }),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: Categoria) => { setEditingId(item.id); setModalOpen(true); };
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderItem = (item: Categoria, isChild = false) => {
    const children = getChildren(item.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(item.id);

    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-40" : ""} ${isChild ? "ml-5" : ""}`}
        >
          {!isChild && hasChildren ? (
            <button onClick={() => toggleExpand(item.id)} className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </button>
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isChild ? "bg-muted-foreground/40" : "bg-primary/40"}`} />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium text-foreground truncate ${isChild ? "text-muted-foreground" : ""}`}>{item.nome}</p>
          </div>
          {!isChild && hasChildren && (
            <span className="text-[9px] text-muted-foreground">{children.length} sub</span>
          )}
          <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${item.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}`}>
            {item.ativo ? "Ativo" : "Inativo"}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(item)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                <Power className={`w-4 h-4 mr-2 ${item.ativo ? "text-emerald-400" : ""}`} /> {item.ativo ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!isChild && isExpanded && children.map((child) => renderItem(child, true))}
      </div>
    );
  };

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Tag className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Categorias de Cadastro</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Organize fornecedores e clientes</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Nova
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : parents.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Nenhuma categoria cadastrada.</div>
        ) : (
          <div>{parents.map((item) => renderItem(item))}</div>
        )}
      </CardContent>

      <CategoriaCadastroModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </Card>
  );
}
