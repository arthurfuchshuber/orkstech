import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useDepartamentos, useCargos, useTiposVinculo } from "@/hooks/useRH";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

const EMPTY = {
  nome: "", email: "", telefone: "", cpf: "", rg: "",
  data_nascimento: "", data_admissao: "", data_demissao: "",
  cargo_id: "", departamento_id: "", tipo_vinculo_id: "",
  salario: "", jornada_horas: "220",
  pix_chave: "", banco: "", agencia: "", conta: "",
  endereco_logradouro: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_estado: "", endereco_cep: "",
  observacoes: "", status: "ativo",
};

export function ColaboradorModal({ open, onOpenChange, editingId, onSaved }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(EMPTY);

  const { data: deps = [] } = useDepartamentos();
  const { data: cargos = [] } = useCargos();
  const { data: vinculos = [] } = useTiposVinculo();

  const { data: existing } = useQuery({
    queryKey: ["colab_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      const f: any = { ...EMPTY };
      Object.keys(EMPTY).forEach((k) => { f[k] = (existing as any)[k] ?? EMPTY[k as keyof typeof EMPTY]; });
      setForm(f);
    } else if (!editingId && open) {
      setForm(EMPTY);
    }
  }, [existing, editingId, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      Object.keys(EMPTY).forEach((k) => {
        let v = form[k];
        if (k === "salario" || k === "jornada_horas") v = v === "" ? null : Number(v);
        if (v === "") v = null;
        payload[k] = v;
      });
      if (editingId) {
        const { error } = await supabase.from("colaboradores").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        payload.user_id = targetUserId;
        payload.empresa_id = empresa?.id ?? null;
        payload.ativo = true;
        const { data, error } = await supabase.from("colaboradores").insert(payload).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["rh_colaboradores"] });
      qc.invalidateQueries({ queryKey: ["rh_colaborador", id] });
      toast.success(editingId ? "Colaborador atualizado" : "Colaborador criado");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle></DialogHeader>

        <div className="space-y-5 py-2">
          <Section title="Dados pessoais">
            <Field label="Nome completo *"><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={60} /></Field>
            <Field label="E-mail"><Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} type="email" maxLength={60} /></Field>
            <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} maxLength={20} /></Field>
            <Field label="CPF"><Input value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} maxLength={14} /></Field>
            <Field label="RG"><Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} maxLength={20} /></Field>
            <Field label="Data de nascimento"><Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} /></Field>
          </Section>

          <Section title="Vínculo & Cargo">
            <Field label="Tipo de vínculo">
              <SimpleSelect value={form.tipo_vinculo_id} onChange={(v) => set("tipo_vinculo_id", v)} options={vinculos} />
            </Field>
            <Field label="Cargo">
              <SimpleSelect value={form.cargo_id} onChange={(v) => set("cargo_id", v)} options={cargos} />
            </Field>
            <Field label="Departamento">
              <SimpleSelect value={form.departamento_id} onChange={(v) => set("departamento_id", v)} options={deps} />
            </Field>
            <Field label="Data de admissão"><Input type="date" value={form.data_admissao ?? ""} onChange={(e) => set("data_admissao", e.target.value)} /></Field>
            <Field label="Data de demissão"><Input type="date" value={form.data_demissao ?? ""} onChange={(e) => set("data_demissao", e.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="ferias">Em férias</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="demitido">Demitido</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Remuneração">
            <Field label="Salário base (R$)"><Input type="number" step="0.01" value={form.salario ?? ""} onChange={(e) => set("salario", e.target.value)} /></Field>
            <Field label="Jornada (horas/mês)"><Input type="number" value={form.jornada_horas ?? ""} onChange={(e) => set("jornada_horas", e.target.value)} /></Field>
          </Section>

          <Section title="Dados bancários">
            <Field label="Chave PIX"><Input value={form.pix_chave ?? ""} onChange={(e) => set("pix_chave", e.target.value)} maxLength={60} /></Field>
            <Field label="Banco"><Input value={form.banco ?? ""} onChange={(e) => set("banco", e.target.value)} maxLength={60} /></Field>
            <Field label="Agência"><Input value={form.agencia ?? ""} onChange={(e) => set("agencia", e.target.value)} maxLength={20} /></Field>
            <Field label="Conta"><Input value={form.conta ?? ""} onChange={(e) => set("conta", e.target.value)} maxLength={20} /></Field>
          </Section>

          <Section title="Observações">
            <div className="col-span-2">
              <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.nome?.trim() || save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 pb-1">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>);
}
function SimpleSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: any[] }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
      <SelectContent>
        {options.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cadastro disponível</div>}
        {options.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}
