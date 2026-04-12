import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { Plus, Pencil, Trash2, Power, Target } from "lucide-react";

interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export function CentrosCustoSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("*")
        .eq("user_id", user!.id)
        .order("nome");
      if (error) throw error;
      return data as CentroCusto[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("centros_custo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo excluído");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("centros_custo").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["centros_custo"] }),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: CentroCusto) => { setEditingId(item.id); setModalOpen(true); };

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Centros de Custo</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Distribua custos por área</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Novo
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto max-h-[420px]">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Nenhum centro de custo cadastrado.</div>
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
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEdit(item)}><Pencil className="w-2.5 h-2.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                    <Power className={`w-2.5 h-2.5 ${item.ativo ? "text-emerald-400" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CentroCustoModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </Card>
  );
}
