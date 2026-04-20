import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Wand2, ArrowUp, ArrowDown, Play, Zap, Eye } from "lucide-react";
import { toast } from "sonner";

type Operador = "contains" | "equals" | "starts_with" | "gte" | "lte" | "between";
type Campo = "description" | "supplier_name" | "amount" | "cliente_id" | "supplier_id" | "payment_method_id";

interface Condicao {
  campo: Campo;
  operador: Operador;
  valor: string;
  valor2?: string;
}

interface Regra {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  escopo: "visualizacao" | "persistir";
  condicoes: Condicao[];
  condicao_logica: "AND" | "OR";
  categoria_destino_id: string;
  aplicar_em: "pagar" | "receber" | "ambos";
  executado_count: number;
  ultima_execucao: string | null;
}

const camposLabel: Record<Campo, string> = {
  description: "Descrição",
  supplier_name: "Nome do Fornecedor (texto)",
  amount: "Valor",
  cliente_id: "Cliente",
  supplier_id: "Fornecedor",
  payment_method_id: "Forma de Pagamento",
};

const operadoresPorCampo: Record<Campo, { value: Operador; label: string }[]> = {
  description: [
    { value: "contains", label: "contém" },
    { value: "starts_with", label: "começa com" },
    { value: "equals", label: "é igual a" },
  ],
  supplier_name: [
    { value: "contains", label: "contém" },
    { value: "starts_with", label: "começa com" },
    { value: "equals", label: "é igual a" },
  ],
  amount: [
    { value: "equals", label: "igual a" },
    { value: "gte", label: "maior ou igual a" },
    { value: "lte", label: "menor ou igual a" },
    { value: "between", label: "entre" },
  ],
  cliente_id: [{ value: "equals", label: "é" }],
  supplier_id: [{ value: "equals", label: "é" }],
  payment_method_id: [{ value: "equals", label: "é" }],
};

const emptyRegra = (): Partial<Regra> => ({
  nome: "",
  ativo: true,
  escopo: "visualizacao",
  condicoes: [{ campo: "description", operador: "contains", valor: "" }],
  condicao_logica: "AND",
  categoria_destino_id: "",
  aplicar_em: "ambos",
});

export function DRERegrasSection() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Regra> | null>(null);

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["dre-regras", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_regras" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Regra[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-regras-categorias", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo, categoria_pai_id")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["dre-regras-clientes", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome_completo, razao_social, nome_fantasia")
        .eq("user_id", targetUserId!)
        .eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["dre-regras-fornecedores", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, nome_completo, razao_social, nome_fantasia")
        .eq("user_id", targetUserId!)
        .eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: formasPag = [] } = useQuery({
    queryKey: ["dre-regras-formas", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("formas_pagamento")
        .select("id, nome")
        .eq("user_id", targetUserId!)
        .eq("ativo", true);
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (r: Partial<Regra>) => {
      const payload = {
        user_id: targetUserId,
        empresa_id: empresa?.id ?? null,
        nome: r.nome,
        ativo: r.ativo ?? true,
        ordem: r.ordem ?? regras.length,
        escopo: r.escopo,
        condicoes: r.condicoes,
        condicao_logica: r.condicao_logica,
        categoria_destino_id: r.categoria_destino_id,
        aplicar_em: r.aplicar_em,
      };
      if (r.id) {
        const { error } = await supabase.from("dre_regras" as any).update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dre_regras" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dre-regras"] });
      setOpen(false);
      setEditing(null);
      toast.success("Regra salva com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("dre_regras" as any).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dre-regras"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dre_regras" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dre-regras"] });
      toast.success("Regra excluída");
    },
  });

  const reorderMut = useMutation({
    mutationFn: async ({ id, ordem }: { id: string; ordem: number }) => {
      const { error } = await supabase.from("dre_regras" as any).update({ ordem }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dre-regras"] }),
  });

  const aplicarRetroativo = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("aplicar_regras_retroativo" as any, { p_user_id: targetUserId });
      if (error) throw error;
      return data as { pagar: number; receber: number; extrato?: number; total: number };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["dre-regras"] });
      qc.invalidateQueries({ queryKey: ["dre-transactions"] });
      qc.invalidateQueries({ queryKey: ["dre-unified-tx"] });
      qc.invalidateQueries({ queryKey: ["dre-unified-prev-tx"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      const ext = d.extrato ?? 0;
      toast.success(`${d.total} lançamento(s) reclassificado(s) (${d.pagar} a pagar, ${d.receber} a receber, ${ext} no extrato)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= regras.length) return;
    reorderMut.mutate({ id: regras[idx].id, ordem: next });
    reorderMut.mutate({ id: regras[next].id, ordem: idx });
  };

  const nomeCliente = (c: any) => c.nome_fantasia || c.razao_social || c.nome_completo || "—";

  const resumoCondicoes = (r: Regra) => {
    if (!r.condicoes?.length) return "—";
    return r.condicoes
      .map((c) => {
        const op = operadoresPorCampo[c.campo]?.find((o) => o.value === c.operador)?.label ?? c.operador;
        let val = c.valor;
        if (c.campo === "cliente_id") val = nomeCliente(clientes.find((x) => x.id === c.valor) ?? {});
        if (c.campo === "supplier_id") val = nomeCliente(fornecedores.find((x) => x.id === c.valor) ?? {});
        if (c.campo === "payment_method_id") val = formasPag.find((x) => x.id === c.valor)?.nome ?? val;
        return `${camposLabel[c.campo]} ${op} "${val}"${c.operador === "between" ? ` e "${c.valor2}"` : ""}`;
      })
      .join(r.condicao_logica === "AND" ? " E " : " OU ");
  };

  const nomeCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? "—";

  return (
    <Card className="border-border/50">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Regras de Classificação Automática
          <Badge variant="outline" className="text-[10px] ml-2 font-normal">
            {regras.length} regra{regras.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => aplicarRetroativo.mutate()}
            disabled={aplicarRetroativo.isPending || regras.filter((r) => r.escopo === "persistir" && r.ativo).length === 0}
          >
            <Play className="w-3.5 h-3.5" />
            Aplicar ao histórico
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditing(emptyRegra()); setOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Nova Regra
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : regras.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhuma regra criada. Clique em "Nova Regra" para começar.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {regras.map((r, idx) => (
              <div key={r.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" disabled={idx === regras.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground">{r.nome}</span>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${r.escopo === "persistir" ? "text-success border-success/30" : "text-primary border-primary/30"}`}>
                        {r.escopo === "persistir" ? <><Zap className="w-2.5 h-2.5" /> Persistir</> : <><Eye className="w-2.5 h-2.5" /> Visualização</>}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{r.aplicar_em}</Badge>
                      {r.executado_count > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{r.executado_count} aplicações</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">SE</span> {resumoCondicoes(r)}{" "}
                      <span className="font-medium">ENTÃO classificar como</span>{" "}
                      <span className="text-foreground font-medium">{nomeCategoria(r.categoria_destino_id)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.ativo} onCheckedChange={(v) => toggleMut.mutate({ id: r.id, ativo: v })} />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm("Excluir esta regra?")) deleteMut.mutate(r.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <RegraForm
              regra={editing}
              setRegra={setEditing}
              categorias={categorias}
              clientes={clientes}
              fornecedores={fornecedores}
              formasPag={formasPag}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.nome || !editing?.categoria_destino_id || !editing?.condicoes?.length}
            >
              Salvar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface RegraFormProps {
  regra: Partial<Regra>;
  setRegra: (r: Partial<Regra>) => void;
  categorias: any[];
  clientes: any[];
  fornecedores: any[];
  formasPag: any[];
}

function RegraForm({ regra, setRegra, categorias, clientes, fornecedores, formasPag }: RegraFormProps) {
  const upd = (patch: Partial<Regra>) => setRegra({ ...regra, ...patch });
  const updCond = (i: number, patch: Partial<Condicao>) => {
    const next = [...(regra.condicoes ?? [])];
    next[i] = { ...next[i], ...patch };
    upd({ condicoes: next });
  };
  const addCond = () => upd({ condicoes: [...(regra.condicoes ?? []), { campo: "description", operador: "contains", valor: "" }] });
  const removeCond = (i: number) => upd({ condicoes: (regra.condicoes ?? []).filter((_, idx) => idx !== i) });

  const nomeEntidade = (c: any) => c.nome_fantasia || c.razao_social || c.nome_completo || "—";

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome da Regra</Label>
        <Input
          value={regra.nome ?? ""}
          onChange={(e) => upd({ nome: e.target.value })}
          placeholder='Ex: "Despesas Google Ads → Marketing Digital"'
          className="h-9 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Aplicar em</Label>
          <Select value={regra.aplicar_em} onValueChange={(v: any) => upd({ aplicar_em: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Contas a Pagar e a Receber</SelectItem>
              <SelectItem value="pagar">Apenas Contas a Pagar</SelectItem>
              <SelectItem value="receber">Apenas Contas a Receber</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Escopo de aplicação</Label>
          <Select value={regra.escopo} onValueChange={(v: any) => upd({ escopo: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="visualizacao">Apenas no DRE (não altera lançamento)</SelectItem>
              <SelectItem value="persistir">Persistir (atualiza categoria do lançamento)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border/40 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">SE (condições)</Label>
          <Select value={regra.condicao_logica} onValueChange={(v: any) => upd({ condicao_logica: v })}>
            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">Todas (E)</SelectItem>
              <SelectItem value="OR">Qualquer (OU)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(regra.condicoes ?? []).map((c, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <Select value={c.campo} onValueChange={(v: Campo) => updCond(i, { campo: v, operador: operadoresPorCampo[v][0].value, valor: "" })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(camposLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={c.operador} onValueChange={(v: Operador) => updCond(i, { operador: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {operadoresPorCampo[c.campo].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {c.campo === "cliente_id" ? (
                <Select value={c.valor} onValueChange={(v) => updCond(i, { valor: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((x) => <SelectItem key={x.id} value={x.id}>{nomeEntidade(x)}</SelectItem>)}</SelectContent>
                </Select>
              ) : c.campo === "supplier_id" ? (
                <Select value={c.valor} onValueChange={(v) => updCond(i, { valor: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{fornecedores.map((x) => <SelectItem key={x.id} value={x.id}>{nomeEntidade(x)}</SelectItem>)}</SelectContent>
                </Select>
              ) : c.campo === "payment_method_id" ? (
                <Select value={c.valor} onValueChange={(v) => updCond(i, { valor: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{formasPag.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent>
                </Select>
              ) : c.operador === "between" ? (
                <div className="flex gap-1">
                  <Input className="h-8 text-xs" placeholder="Min" value={c.valor} onChange={(e) => updCond(i, { valor: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Max" value={c.valor2 ?? ""} onChange={(e) => updCond(i, { valor2: e.target.value })} />
                </div>
              ) : (
                <Input
                  className="h-8 text-xs"
                  type={c.campo === "amount" ? "number" : "text"}
                  placeholder="Valor"
                  value={c.valor}
                  onChange={(e) => updCond(i, { valor: e.target.value })}
                />
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeCond(i)} disabled={(regra.condicoes?.length ?? 0) <= 1}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addCond}>
          <Plus className="w-3 h-3" /> Adicionar condição
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">ENTÃO classificar como</Label>
        <Select value={regra.categoria_destino_id} onValueChange={(v) => upd({ categoria_destino_id: v })}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a categoria de destino" /></SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} <span className="text-muted-foreground text-xs ml-1">({c.tipo})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Switch checked={regra.ativo ?? true} onCheckedChange={(v) => upd({ ativo: v })} />
        <Label className="text-xs">Regra ativa</Label>
      </div>
    </div>
  );
}
