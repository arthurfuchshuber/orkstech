import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { Plus, Pencil, Trash2, Power, CreditCard, QrCode, FileBarChart, ArrowLeftRight, Banknote } from "lucide-react";

type TipoForma = "pix" | "boleto" | "cartao" | "transferencia" | "dinheiro";

const tipoLabels: Record<TipoForma, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

const tipoIcons: Record<TipoForma, typeof CreditCard> = {
  pix: QrCode,
  boleto: FileBarChart,
  cartao: CreditCard,
  transferencia: ArrowLeftRight,
  dinheiro: Banknote,
};

interface FormaPagamento {
  id: string;
  nome: string;
  tipo: TipoForma;
  ativo: boolean;
}

export default function FormasDePagamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("user_id", user!.id)
        .order("nome");
      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("formas_pagamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["formas_pagamento"] });
      toast.success("Forma de pagamento excluída");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("formas_pagamento").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formas_pagamento"] }),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: FormaPagamento) => { setEditingId(item.id); setModalOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Formas de Pagamento</h1>
            <p className="text-sm text-muted-foreground">Gerencie as formas de pagamento disponíveis</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Forma</Button>
      </div>

      <Card className="divide-y divide-border/50">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma forma de pagamento cadastrada.</div>
        ) : items.map((item) => {
          const Icon = tipoIcons[item.tipo];
          return (
            <div key={item.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-50" : ""}`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.nome}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{tipoLabels[item.tipo]}</Badge>
              <Badge variant="outline" className={item.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>
                {item.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                  <Power className={`w-3.5 h-3.5 ${item.ativo ? "text-emerald-400" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </Card>

      <FormaPagamentoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
      />
    </div>
  );
}
