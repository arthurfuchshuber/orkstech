import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { BancoModal } from "./BancoModal";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Landmark } from "lucide-react";

type TipoConta = "corrente" | "poupanca" | "caixa" | "carteira_digital";

interface ContaBancariaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function ContaBancariaModal({ open, onOpenChange, editingId, onSaved }: ContaBancariaModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: "",
    banco_id: "",
    tipo: "corrente" as TipoConta,
    saldo_inicial: "0",
    saldo_investimento: "0",
    pessoa_tipo: "pj" as "pj" | "pf",
  });
  const [bancoModalOpen, setBancoModalOpen] = useState(false);
  const [bancoEditingId, setBancoEditingId] = useState<string | null>(null);

  const bancosCrud = useManagedSelect("bancos");

  useEffect(() => {
    if (user && open) {
      supabase.rpc("seed_default_bancos", { p_user_id: user.id }).then(() => {
        qc.invalidateQueries({ queryKey: ["bancos"] });
      });
    }
  }, [user, open]);

  const { data: bancos = [] } = useQuery({
    queryKey: ["bancos"],
    queryFn: async () => {
      const { data } = await supabase.from("bancos").select("id, codigo, nome").eq("ativo", true).order("ordem");
      return data ?? [];
    },
    enabled: !!user,
  });

  const tipoContaOptions = [
    { value: "corrente", label: "Corrente" },
    { value: "poupanca", label: "Poupança" },
    { value: "caixa", label: "Caixa" },
    { value: "carteira_digital", label: "Carteira Digital" },
  ];

  const { data: existing } = useQuery({
    queryKey: ["contas_bancarias_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({
        nome: existing.nome,
        banco_id: existing.banco_id || "",
        tipo: existing.tipo as TipoConta,
        saldo_inicial: String(existing.saldo_inicial),
        saldo_investimento: String((existing as any).saldo_investimento ?? 0),
        pessoa_tipo: (existing as any).pessoa_tipo || "pj",
      });
    } else if (!editingId && open) {
      setForm({ nome: "", banco_id: "", tipo: "corrente", saldo_inicial: "0", saldo_investimento: "0", pessoa_tipo: "pj" });
    }
  }, [existing, editingId, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedBanco = bancos.find((b: any) => b.id === form.banco_id);
      const bancoLabel = selectedBanco ? `${selectedBanco.codigo} - ${selectedBanco.nome}` : null;

      const payload: any = {
        nome: form.nome,
        banco: bancoLabel,
        banco_id: form.banco_id || null,
        tipo: form.tipo,
        saldo_inicial: parseFloat(form.saldo_inicial) || 0,
        saldo_investimento: parseFloat(form.saldo_investimento) || 0,
        pessoa_tipo: form.pessoa_tipo,
      };
      if (editingId) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("contas_bancarias").insert({ ...payload, user_id: user!.id }).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
      toast.success(editingId ? "Conta atualizada" : "Conta criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Pessoa</label>
              <RadioGroup value={form.pessoa_tipo} onValueChange={(v) => setForm({ ...form, pessoa_tipo: v as "pj" | "pf" })} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="pj" />
                  <span className="text-sm">Pessoa Jurídica (PJ)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="pf" />
                  <span className="text-sm">Pessoa Física (PF)</span>
                </label>
              </RadioGroup>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da Conta</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Conta Principal" maxLength={60} />
            </div>
            <ManagedSelectInput
              label="Banco"
              value={form.banco_id}
              onValueChange={(v) => setForm({ ...form, banco_id: v })}
              options={bancos.map((b: any) => ({ value: b.id, label: b.codigo ? `${b.codigo} - ${b.nome}` : b.nome }))}
              placeholder="Selecione o banco..."
              icon={<Landmark className="w-4 h-4" />}
              onAddModal={() => { setBancoEditingId(null); setBancoModalOpen(true); }}
              onEditModal={(id) => { setBancoEditingId(id); setBancoModalOpen(true); }}
              onDelete={bancosCrud.onDelete}
              onReorder={bancosCrud.onReorder}
              addLabel="Novo banco"
            />
            <ManagedSelectInput
              label="Tipo"
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v as TipoConta })}
              options={tipoContaOptions}
              placeholder="Selecione o tipo..."
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Saldo Inicial (R$)</label>
              <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Saldo de Investimento (R$)</label>
              <Input type="number" step="0.01" value={form.saldo_investimento} onChange={(e) => setForm({ ...form, saldo_investimento: e.target.value })} placeholder="0,00" />
              <p className="text-[11px] text-muted-foreground mt-1">Valor aplicado em investimentos vinculado a esta conta (CDB, Tesouro, Poupança, etc.)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BancoModal
        open={bancoModalOpen}
        onOpenChange={setBancoModalOpen}
        editingId={bancoEditingId}
        onSaved={(id) => setForm((prev) => ({ ...prev, banco_id: id }))}
      />
    </>
  );
}
