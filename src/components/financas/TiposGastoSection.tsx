import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TipoGastoModal } from "@/components/modals/TipoGastoModal";
import { Plus, Pencil, Trash2, Power, Tags, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TG {
  id: string;
  nome: string;
  emoji: string;
  ativo: boolean;
}

export function TiposGastoSection() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["tipos_gasto", empresa?.id],
    enabled: !!user && !!empresa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_gasto" as any)
        .select("*")
        .eq("empresa_id", empresa!.id)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as TG[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tipos_gasto"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tipos_gasto" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tipo excluído"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("tipos_gasto" as any).update({ ativo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: TG) => { setEditingId(item.id); setModalOpen(true); };

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Tags className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Tipos de Gasto</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Categorize lançamentos por natureza (alimentação, transporte, etc.)
            </p>
          </div>
        </div>
        <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Novo
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            Nenhum tipo cadastrado.
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-40" : ""}`}
              >
                <span className="text-lg leading-none w-6 text-center">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.nome}</p>
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

      <TipoGastoModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </Card>
  );
}
