import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BusinessUnitModal } from "@/components/modals/BusinessUnitModal";
import { Plus, Pencil, Trash2, Power, Layers, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BU {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export function BusinessUnitsSection() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["business_units", empresa?.id, false],
    enabled: !!user && !!empresa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_units" as any)
        .select("*")
        .eq("empresa_id", empresa!.id)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as BU[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["business_units"] });
    qc.invalidateQueries({ queryKey: ["business-units"] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_units" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Unidade excluída"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("business_units" as any).update({ ativo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: BU) => { setEditingId(item.id); setModalOpen(true); };

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Unidades de Negócio</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Produtos / operações para DRE multioperação
            </p>
          </div>
        </div>
        <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Nova
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            Nenhuma unidade cadastrada.<br />
            <span className="text-[10px]">Crie unidades para filtrar o DRE por produto/operação.</span>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-40" : ""}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.nome}</p>
                  {item.descricao && <p className="text-[10px] text-muted-foreground truncate">{item.descricao}</p>}
                </div>
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
            ))}
          </div>
        )}
      </CardContent>

      <BusinessUnitModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </Card>
  );
}
