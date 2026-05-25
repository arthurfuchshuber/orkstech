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
import { Plus, Pencil, Trash2, Power, Landmark, Wallet, PiggyBank, Banknote, ChevronDown, ArrowLeftRight, Receipt } from "lucide-react";
import { PluggyConnectButton, PluggyConnectionsList, usePluggyConnections } from "@/components/PluggyConnectButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CaixinhaMoveDialog } from "@/components/financas/conta/CaixinhaMoveDialog";
import { LancamentoManualContaDialog } from "@/components/financas/conta/LancamentoManualContaDialog";
import { PageHeader } from "@/components/PageHeader";

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
  saldo_investimento: number;
  ativo: boolean;
}

export default function ContasBancarias({
  embedded = false,
  readOnly = false,
  hideOpenFinanceButton = false,
}: {
  embedded?: boolean;
  readOnly?: boolean;
  hideOpenFinanceButton?: boolean;
}) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caixinhaTarget, setCaixinhaTarget] = useState<ContaBancaria | null>(null);
  const [lancTarget, setLancTarget] = useState<ContaBancaria | null>(null);

  // Use empresa owner's user_id for Super Admin cross-tenant visibility
  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contas_bancarias", empresaId, targetUserId],
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("*")
        .eq("user_id", targetUserId!)
        // Exclui espelhos automáticos das integrações Open Finance (Pluggy):
        // eles já aparecem na lista "PluggyConnectionsList" acima e não devem
        // duplicar como se fossem contas manuais.
        .is("pluggy_account_id", null)
        .order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ContaBancaria[];
    },
    enabled: !!user && !!targetUserId,
  });

  // Calcula saldo atual real (saldo_inicial + Σ cash_transactions) para cada conta
  const { data: saldosCalc = {} } = useQuery({
    queryKey: ["conta_saldo", items.map((i) => i.id).join(",")],
    enabled: items.length > 0,
    queryFn: async () => {
      const result: Record<string, number> = {};
      for (const it of items) {
        const { data } = await supabase.rpc("calcular_saldo_esperado_conta" as any, { p_conta_id: it.id });
        result[it.id] = Number(data ?? it.saldo_inicial ?? 0);
      }
      return result;
    },
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { connections } = embedded ? usePluggyConnections() : { connections: [] };
  const hasAnyData = items.length > 0 || connections.length > 0;

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
              {!readOnly && (
                <Button onClick={openNew} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
                  <Plus className="w-3 h-3" /> Nova Conta Manual
                </Button>
              )}
              {!hideOpenFinanceButton && !readOnly && <PluggyConnectButton size="sm" />}
            </div>
          </CardHeader>

          <CardContent className="px-2 pb-3 flex-1 overflow-auto">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
            ) : !hasAnyData ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Nenhuma conta cadastrada.</div>
            ) : (
              <div className="space-y-0.5">
                <PluggyConnectionsList />
                {items.map((item) => {
                  const Icon = tipoIcons[item.tipo];
                  const saldoAtual = saldosCalc[item.id] ?? item.saldo_inicial;
                  const caixinha = Number(item.saldo_investimento ?? 0);
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
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap" title="Saldo atual">{formatCurrency(saldoAtual)}</span>
                        {caixinha > 0 && (
                          <span className="text-[10px] text-emerald-500 whitespace-nowrap" title="Aplicação">+ {formatCurrency(caixinha)}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 leading-4 flex-shrink-0">{tipoLabels[item.tipo]}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLancTarget(item)}>
                            <Receipt className="w-4 h-4 mr-2" /> Novo lançamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCaixinhaTarget(item)}>
                            <ArrowLeftRight className="w-4 h-4 mr-2" /> Mover aplicação
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ContaBancariaModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
        {caixinhaTarget && (
          <CaixinhaMoveDialog
            open={!!caixinhaTarget}
            onOpenChange={(v) => !v && setCaixinhaTarget(null)}
            contaId={caixinhaTarget.id}
            contaNome={caixinhaTarget.nome}
            saldoConta={saldosCalc[caixinhaTarget.id] ?? caixinhaTarget.saldo_inicial}
            saldoCaixinha={Number(caixinhaTarget.saldo_investimento ?? 0)}
          />
        )}
        {lancTarget && (
          <LancamentoManualContaDialog
            open={!!lancTarget}
            onOpenChange={(v) => !v && setLancTarget(null)}
            contaId={lancTarget.id}
            contaNome={lancTarget.nome}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2"><Landmark className="w-5 h-5 text-primary" /> Contas Bancárias</span>}
        description="Gerencie as contas da empresa"
        actions={<Button onClick={openNew} className="gap-2 h-10"><Plus className="w-4 h-4" /> <span className="whitespace-nowrap">Nova Conta</span></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Nenhuma conta cadastrada.</div>
        ) : items.map((item) => {
          const Icon = tipoIcons[item.tipo];
          const saldoAtual = saldosCalc[item.id] ?? item.saldo_inicial;
          const caixinha = Number(item.saldo_investimento ?? 0);
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
              <div className="space-y-1">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Atual</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(saldoAtual)}</p>
                </div>
                <div className="flex justify-between text-[11px] border-t border-border/40 pt-1.5">
                  <span className="text-muted-foreground">Saldo inicial</span>
                  <span className="text-foreground font-medium tabular-nums">{formatCurrency(item.saldo_inicial)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Aplicação</span>
                  <span className={`font-medium tabular-nums ${caixinha > 0 ? "text-emerald-500" : "text-foreground"}`}>{formatCurrency(caixinha)}</span>
                </div>
              </div>
              <div className="flex gap-1 justify-end border-t border-border/50 pt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-lg">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLancTarget(item)}>
                      <Receipt className="w-4 h-4 mr-2" /> Novo lançamento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCaixinhaTarget(item)}>
                      <ArrowLeftRight className="w-4 h-4 mr-2" /> Mover aplicação
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
            </Card>
          );
        })}
      </div>

      <ContaBancariaModal open={modalOpen} onOpenChange={setModalOpen} editingId={editingId} />
      {caixinhaTarget && (
        <CaixinhaMoveDialog
          open={!!caixinhaTarget}
          onOpenChange={(v) => !v && setCaixinhaTarget(null)}
          contaId={caixinhaTarget.id}
          contaNome={caixinhaTarget.nome}
          saldoConta={saldosCalc[caixinhaTarget.id] ?? caixinhaTarget.saldo_inicial}
          saldoCaixinha={Number(caixinhaTarget.saldo_investimento ?? 0)}
        />
      )}
      {lancTarget && (
        <LancamentoManualContaDialog
          open={!!lancTarget}
          onOpenChange={(v) => !v && setLancTarget(null)}
          contaId={lancTarget.id}
          contaNome={lancTarget.nome}
        />
      )}
    </div>
  );
}