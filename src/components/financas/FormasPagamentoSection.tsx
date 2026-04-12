import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { Plus, Pencil, Trash2, Power, CreditCard, QrCode, FileBarChart, ArrowLeftRight, Banknote } from "lucide-react";

type TipoForma = "pix" | "boleto" | "cartao" | "transferencia" | "dinheiro";

const tipoLabels: Record<TipoForma, string> = {
  pix: "PIX", boleto: "Boleto", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro",
};

const tipoIcons: Record<TipoForma, typeof CreditCard> = {
  pix: QrCode, boleto: FileBarChart, cartao: CreditCard, transferencia: ArrowLeftRight, dinheiro: Banknote,
};

interface FormaPagamento {
  id: string;
  nome: string;
  tipo: TipoForma;
  ativo: boolean;
}

export function FormasPagamentoSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("formas_pagamento").select("*").eq("user_id", user!.id).order("nome");
      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("formas_pagamento").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["formas_pagamento"] }); toast.success("Forma de pagamento excluída"); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => { const { error } = await supabase.from("formas_pagamento").update({ ativo }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formas_pagamento"] }),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: FormaPagamento) => { setEditingId(item.id); setModalOpen(true); };

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Formas de Pagamento</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Meios aceitos para lançamentos</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Nova
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3">
        {isLoading ? (
          <div className="py-6 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-xs">Nenhuma forma cadastrada.</div>
        ) : (
          <div>
            {items.map((item) => {
              const Icon = tipoIcons[item.tipo];
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-40" : ""}`}
                >
                  <div className="w-6 h-6 rounded-md bg-muted/40 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-foreground flex-1 truncate">{item.nome}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 leading-4">{tipoLabels[item.tipo]}</Badge>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEdit(item)}><Pencil className="w-2.5 h-2.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                      <Power className={`w-2.5 h-2.5 ${item.ativo ? "text-emerald-400" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <FormaPagamentoModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </Card>
  );
}
