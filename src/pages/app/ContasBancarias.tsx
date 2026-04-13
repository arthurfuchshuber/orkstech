import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { Plus, Pencil, Trash2, Power, Landmark, Wallet, PiggyBank, Banknote } from "lucide-react";
import { PluggyConnectButton } from "@/components/PluggyConnectButton";

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

export default function ContasBancarias({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contas_bancarias", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("*")
        .eq("user_id", user!.id)
        .order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
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
    onSuccess: async () => {
      await refreshQueries(qc, [["contas_bancarias"], ["contas-bancarias"]]);
      toast.success("Conta excluída");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("contas_bancarias").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(qc, [["contas_bancarias"], ["contas-bancarias"]]);
    },
  });

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (item: ContaBancaria) => { setEditingId(item.id); setModalOpen(true); };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (embedded) {
    return (
      <>
        <Card className="border-border/40 shadow-sm flex flex-col">
          <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Contas Bancárias</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Gerencie contas e integrações</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
                <Plus className="w-3 h-3" /> Nova Conta Manual
              </Button>
              <PluggyConnectButton />
            </div>
          </CardHeader>

          <CardContent className="px-2 pb-3 flex-1 overflow-auto">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Nenhuma conta cadastrada.</div>
            ) : (
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = tipoIcons[item.tipo];
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors group hover:bg-muted/30 ${!item.ativo ? "opacity-40" : ""}`}
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground truncate block">{item.nome}</span>
                        {item.banco && <span className="text-[10px] text-muted-foreground truncate block">{item.banco}</span>}
                      </div>
                      <span className="text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(item.saldo_inicial)}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 leading-4 flex-shrink-0">{tipoLabels[item.tipo]}</Badge>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEdit(item)}><Pencil className="w-2.5 h-2.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                          <Power className={`w-2.5 h-2.5 ${item.ativo ? "text-emerald-400" : "text-muted-foreground"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ContaBancariaModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
      </>
    );
  }

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

      <ContaBancariaModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
    </div>
  );
}