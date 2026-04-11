import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { Plus, Pencil, Trash2, Power, Landmark, Wallet, PiggyBank, Banknote } from "lucide-react";

type TipoConta = "corrente" | "poupanca" | "caixa" | "carteira_digital";

const tipoLabels: Record<TipoConta, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  caixa: "Caixa",
  carteira_digital: "Carteira Digital",
};

const tipoIcons: Record<TipoConta, typeof Landmark> = {
  corrente: Landmark,
  poupanca: PiggyBank,
  caixa: Banknote,
  carteira_digital: Wallet,
};

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
  tipo: TipoConta;
  saldo_inicial: number;
  ativo: boolean;
}

export default function ContasBancarias() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("user_id", user!.id)
        .order("nome");
      if (error) throw error;
      return data as ContaBancaria[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_bancarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast.success("Conta excluída");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("contas_bancarias").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contas_bancarias"] }),
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: ContaBancaria) => { setEditingId(item.id); setModalOpen(true); };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Contas Bancárias</h1>
            <p className="text-sm text-muted-foreground">Gerencie as contas da empresa</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Conta</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Nenhuma conta cadastrada.</div>
        ) : items.map((item) => {
          const Icon = tipoIcons[item.tipo];
          return (
            <Card key={item.id} className={`p-4 space-y-3 ${!item.ativo ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.nome}</p>
                    {item.banco && <p className="text-xs text-muted-foreground">{item.banco}</p>}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{tipoLabels[item.tipo]}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Inicial</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(item.saldo_inicial)}</p>
              </div>
              <div className="flex gap-1 justify-end border-t border-border/50 pt-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                  <Power className={`w-3.5 h-3.5 ${item.ativo ? "text-emerald-400" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ContaBancariaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
      />
    </div>
  );
}
