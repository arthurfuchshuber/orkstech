import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserCircle2, Pencil, Plus, Trash2, Laptop, Key, Gift, FileText, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { ColaboradorModal } from "@/components/rh/ColaboradorModal";
import { useColaborador, useDepartamentos, useCargos, useTiposVinculo, useTiposBeneficio, useFerramentas, useCategoriasEquipamento, useTiposAusencia } from "@/hooks/useRH";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RHColaboradorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading } = useColaborador(id);
  const [editOpen, setEditOpen] = useState(false);

  const { data: deps = [] } = useDepartamentos();
  const { data: cargos = [] } = useCargos();
  const { data: vinculos = [] } = useTiposVinculo();
  const depMap = new Map(deps.map((d: any) => [d.id, d.nome]));
  const cargoMap = new Map(cargos.map((d: any) => [d.id, d.nome]));
  const vincMap = new Map(vinculos.map((d: any) => [d.id, d.nome]));

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  if (!c) return <div className="p-8 text-sm text-muted-foreground">Colaborador não encontrado.</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <Link to="/app/rh/colaboradores" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-1.5">
          <ArrowLeft className="w-3 h-3" /> Voltar para colaboradores
        </Link>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{c.nome}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {c.cargo_id && <span>{cargoMap.get(c.cargo_id) ?? c.cargo}</span>}
                  {c.departamento_id && <span>· {depMap.get(c.departamento_id) ?? c.departamento}</span>}
                  {c.tipo_vinculo_id && <span>· {vincMap.get(c.tipo_vinculo_id)}</span>}
                  <Badge variant="outline" className={c.ativo ? "text-emerald-400 border-emerald-500/20" : ""}>
                    {c.ativo ? (c.status ?? "Ativo") : "Inativo"}
                  </Badge>
                </div>
              </div>
              <Button onClick={() => setEditOpen(true)} variant="outline" size="sm" className="gap-2">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/40">
              <Stat label="Salário base" value={c.salario ? `R$ ${Number(c.salario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"} />
              <Stat label="Admissão" value={c.data_admissao ? new Date(c.data_admissao).toLocaleDateString("pt-BR") : "—"} />
              <Stat label="E-mail" value={c.email ?? "—"} />
              <Stat label="Telefone" value={c.telefone ?? "—"} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados"><FileText className="w-3.5 h-3.5 mr-1.5" /> Dados</TabsTrigger>
          <TabsTrigger value="remuneracao"><Gift className="w-3.5 h-3.5 mr-1.5" /> Remuneração</TabsTrigger>
          <TabsTrigger value="ausencias"><CalendarOff className="w-3.5 h-3.5 mr-1.5" /> Ausências</TabsTrigger>
          <TabsTrigger value="equipamentos"><Laptop className="w-3.5 h-3.5 mr-1.5" /> Equipamentos</TabsTrigger>
          <TabsTrigger value="acessos"><Key className="w-3.5 h-3.5 mr-1.5" /> Acessos</TabsTrigger>
          <TabsTrigger value="documentos"><FileText className="w-3.5 h-3.5 mr-1.5" /> Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosTab c={c} />
        </TabsContent>
        <TabsContent value="remuneracao" className="mt-4">
          <BeneficiosTab colaboradorId={c.id} />
        </TabsContent>
        <TabsContent value="ausencias" className="mt-4">
          <AusenciasTab colaboradorId={c.id} />
        </TabsContent>
        <TabsContent value="equipamentos" className="mt-4">
          <EquipamentosTab colaboradorId={c.id} />
        </TabsContent>
        <TabsContent value="acessos" className="mt-4">
          <AcessosTab colaboradorId={c.id} />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab colaboradorId={c.id} />
        </TabsContent>
      </Tabs>

      <ColaboradorModal open={editOpen} onOpenChange={setEditOpen} editingId={c.id} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-medium mt-0.5 truncate">{value}</p></div>;
}

function DadosTab({ c }: { c: any }) {
  const grid = (rows: [string, any][]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 py-1.5 border-b border-border/30 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-right truncate">{value || "—"}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Pessoais</h3>
        {grid([["CPF", c.cpf], ["RG", c.rg], ["Nascimento", c.data_nascimento && new Date(c.data_nascimento).toLocaleDateString("pt-BR")], ["E-mail", c.email], ["Telefone", c.telefone]])}
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Bancários</h3>
        {grid([["PIX", c.pix_chave], ["Banco", c.banco], ["Agência", c.agencia], ["Conta", c.conta]])}
      </Card>
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold mb-3">Endereço</h3>
        {grid([
          ["Logradouro", c.endereco_logradouro], ["Número", c.endereco_numero],
          ["Complemento", c.endereco_complemento], ["Bairro", c.endereco_bairro],
          ["Cidade", c.endereco_cidade], ["UF", c.endereco_estado], ["CEP", c.endereco_cep],
        ])}
      </Card>
      {c.observacoes && (
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-2">Observações</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.observacoes}</p>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Tabs subcomponents ---------------- */

function useEmpresaIds() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  return { user_id: empresa?.user_id ?? user?.id, empresa_id: empresa?.id ?? null };
}

function BeneficiosTab({ colaboradorId }: { colaboradorId: string }) {
  const ids = useEmpresaIds();
  const qc = useQueryClient();
  const { data: tipos = [] } = useTiposBeneficio();
  const tipoMap = new Map(tipos.map((t: any) => [t.id, t]));
  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_colab_benef", colaboradorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_colaborador_beneficios").select("*").eq("colaborador_id", colaboradorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [valor, setValor] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const tipo: any = tipoMap.get(tipoId);
      const { error } = await (supabase as any).from("rh_colaborador_beneficios").insert({
        ...ids, colaborador_id: colaboradorId, tipo_beneficio_id: tipoId,
        valor: Number(valor || tipo?.valor_padrao || 0), desconto: Number(tipo?.desconto_padrao || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setTipoId(""); setValor(""); refetch(); qc.invalidateQueries({ queryKey: ["rh_colab_benef"] }); toast.success("Benefício adicionado"); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_colaborador_beneficios").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refetch(); toast.success("Removido"); },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Benefícios recorrentes</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Nenhum benefício vinculado.</p>
      ) : (
        <div className="space-y-1">
          {list.map((b: any) => {
            const t: any = tipoMap.get(b.tipo_beneficio_id);
            return (
              <div key={b.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30">
                <Gift className="w-4 h-4 text-primary/60" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{t?.nome ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Desconto: R$ {Number(b.desconto || 0).toFixed(2)}</p>
                </div>
                <span className="text-sm font-medium">R$ {Number(b.valor || 0).toFixed(2)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(b.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar benefício</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Tipo</Label>
              <Select value={tipoId} onValueChange={(v) => { setTipoId(v); const t: any = tipoMap.get(v); setValor(String(t?.valor_padrao ?? "")); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{tipos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!tipoId} onClick={() => add.mutate()}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AusenciasTab({ colaboradorId }: { colaboradorId: string }) {
  const ids = useEmpresaIds();
  const { data: tipos = [] } = useTiposAusencia();
  const tipoMap = new Map(tipos.map((t: any) => [t.id, t]));
  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_ausencias", colaboradorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_ausencias").select("*").eq("colaborador_id", colaboradorId).order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo_ausencia_id: "", data_inicio: "", data_fim: "", observacoes: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("rh_ausencias").insert({ ...ids, colaborador_id: colaboradorId, ...form });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ tipo_ausencia_id: "", data_inicio: "", data_fim: "", observacoes: "" }); refetch(); toast.success("Ausência registrada"); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_ausencias").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => refetch(),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Histórico de ausências</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2"><Plus className="w-3.5 h-3.5" /> Registrar</Button>
      </div>
      {list.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Sem registros.</p> : (
        <div className="space-y-1">
          {list.map((a: any) => {
            const t: any = tipoMap.get(a.tipo_ausencia_id);
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30">
                <span className="w-2 h-2 rounded-full" style={{ background: t?.cor ?? "#3b82f6" }} />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{t?.nome ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(a.data_inicio).toLocaleDateString("pt-BR")} → {new Date(a.data_fim).toLocaleDateString("pt-BR")} · {a.dias} dia(s)</p>
                </div>
                <Badge variant="outline">{a.status}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar ausência</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo_ausencia_id} onValueChange={(v) => setForm({ ...form, tipo_ausencia_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{tipos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!form.tipo_ausencia_id || !form.data_inicio || !form.data_fim} onClick={() => add.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EquipamentosTab({ colaboradorId }: { colaboradorId: string }) {
  const ids = useEmpresaIds();
  const { data: cats = [] } = useCategoriasEquipamento();
  const catMap = new Map(cats.map((c: any) => [c.id, c.nome]));
  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_equipamentos_colab", colaboradorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_equipamentos").select("*").eq("colaborador_id", colaboradorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ nome: "", categoria_id: "", marca: "", modelo: "", numero_serie: "", patrimonio: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("rh_equipamentos").insert({ ...ids, ...form, colaborador_id: colaboradorId, status: "em_uso", data_entrega: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ nome: "", categoria_id: "", marca: "", modelo: "", numero_serie: "", patrimonio: "" }); refetch(); toast.success("Equipamento atribuído"); },
    onError: (e: any) => toast.error(e?.message),
  });
  const devolver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rh_equipamentos").update({ colaborador_id: null, status: "estoque", data_devolucao: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Devolvido ao estoque"); },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Equipamentos atribuídos</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2"><Plus className="w-3.5 h-3.5" /> Atribuir</Button>
      </div>
      {list.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhum equipamento.</p> : (
        <div className="space-y-1">
          {list.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30">
              <Laptop className="w-4 h-4 text-primary/60" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{e.nome}</p>
                <p className="text-[11px] text-muted-foreground">{catMap.get(e.categoria_id) ?? "—"} · {e.marca} {e.modelo} {e.numero_serie ? `· SN ${e.numero_serie}` : ""}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => devolver.mutate(e.id)}>Devolver</Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir equipamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} /></div>
            <div><Label className="text-xs">Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Nº de série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Patrimônio</Label><Input value={form.patrimonio} onChange={(e) => setForm({ ...form, patrimonio: e.target.value })} maxLength={60} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!form.nome.trim()} onClick={() => add.mutate()}>Atribuir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AcessosTab({ colaboradorId }: { colaboradorId: string }) {
  const ids = useEmpresaIds();
  const { data: ferramentas = [] } = useFerramentas();
  const ferrMap = new Map(ferramentas.map((f: any) => [f.id, f]));
  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_acessos", colaboradorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_colaborador_acessos").select("*").eq("colaborador_id", colaboradorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ferramenta_id: "", login: "", perfil: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("rh_colaborador_acessos").insert({ ...ids, ...form, colaborador_id: colaboradorId });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ ferramenta_id: "", login: "", perfil: "" }); refetch(); toast.success("Acesso registrado"); },
  });
  const revogar = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_colaborador_acessos").update({ status: "revogado", revogado_em: new Date().toISOString().slice(0, 10) }).eq("id", id); if (error) throw error; },
    onSuccess: () => refetch(),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Acessos a ferramentas</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2"><Plus className="w-3.5 h-3.5" /> Conceder</Button>
      </div>
      {list.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Sem acessos.</p> : (
        <div className="space-y-1">
          {list.map((a: any) => {
            const f: any = ferrMap.get(a.ferramenta_id);
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30">
                <Key className="w-4 h-4 text-primary/60" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{f?.nome ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{a.login} {a.perfil ? `· ${a.perfil}` : ""}</p>
                </div>
                <Badge variant="outline" className={a.status === "ativo" ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>{a.status}</Badge>
                {a.status === "ativo" && <Button size="sm" variant="outline" onClick={() => revogar.mutate(a.id)}>Revogar</Button>}
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder acesso</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Ferramenta</Label>
              <Select value={form.ferramenta_id} onValueChange={(v) => setForm({ ...form, ferramenta_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{ferramentas.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Login</Label><Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} maxLength={60} /></div>
            <div><Label className="text-xs">Perfil/Permissão</Label><Input value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} maxLength={60} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!form.ferramenta_id} onClick={() => add.mutate()}>Conceder</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DocumentosTab({ colaboradorId }: { colaboradorId: string }) {
  const ids = useEmpresaIds();
  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_colab_docs", colaboradorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_colaborador_documentos").select("*").eq("colaborador_id", colaboradorId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo > 10MB");
    const path = `${ids.empresa_id ?? ids.user_id}/${colaboradorId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("rh-documentos").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { data: signed } = await supabase.storage.from("rh-documentos").createSignedUrl(path, 60 * 60 * 24 * 365);
    const { error } = await (supabase as any).from("rh_colaborador_documentos").insert({
      ...ids, colaborador_id: colaboradorId, nome: file.name, tipo: file.type, tamanho: file.size, url: signed?.signedUrl ?? path,
    });
    if (error) return toast.error(error.message);
    refetch(); toast.success("Documento enviado");
  };
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_colaborador_documentos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => refetch(),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Documentos pessoais</h3>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <span className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border text-xs hover:bg-muted/50"><Plus className="w-3.5 h-3.5" /> Enviar arquivo</span>
        </label>
      </div>
      {list.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhum documento.</p> : (
        <div className="space-y-1">
          {list.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30">
              <FileText className="w-4 h-4 text-primary/60" />
              <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 text-sm hover:text-primary truncate">{d.nome}</a>
              <span className="text-[11px] text-muted-foreground">{d.tamanho ? `${Math.round(d.tamanho / 1024)} KB` : ""}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(d.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
