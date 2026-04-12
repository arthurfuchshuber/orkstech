import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Building2, UserRound, Mail, Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/FormModal";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cliente: Tables<"clientes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteEditModal({ cliente, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const isPF = cliente.tipo === "pf";

  const [form, setForm] = useState({
    nome_completo: cliente.nome_completo || "",
    cpf: cliente.cpf || "",
    razao_social: cliente.razao_social || "",
    nome_fantasia: cliente.nome_fantasia || "",
    cnpj: cliente.cnpj || "",
    inscricao_estadual: cliente.inscricao_estadual || "",
    inscricao_municipal: cliente.inscricao_municipal || "",
    telefone: cliente.telefone || "",
    whatsapp: (cliente as any).whatsapp || "",
    email: cliente.email || "",
    logradouro: cliente.logradouro || "",
    numero: (cliente as any).numero || "",
    complemento: (cliente as any).complemento || "",
    bairro: cliente.bairro || "",
    cidade: cliente.cidade || "",
    estado: cliente.estado || "",
    cep: cliente.cep || "",
    responsavel_interno: (cliente as any).responsavel_interno || "",
    observacoes: cliente.observacoes || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome_completo: cliente.nome_completo || "",
        cpf: cliente.cpf || "",
        razao_social: cliente.razao_social || "",
        nome_fantasia: cliente.nome_fantasia || "",
        cnpj: cliente.cnpj || "",
        inscricao_estadual: cliente.inscricao_estadual || "",
        inscricao_municipal: cliente.inscricao_municipal || "",
        telefone: cliente.telefone || "",
        whatsapp: (cliente as any).whatsapp || "",
        email: cliente.email || "",
        logradouro: cliente.logradouro || "",
        numero: (cliente as any).numero || "",
        complemento: (cliente as any).complemento || "",
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
        cep: cliente.cep || "",
        responsavel_interno: (cliente as any).responsavel_interno || "",
        observacoes: cliente.observacoes || "",
      });
    }
  }, [open, cliente]);

  const mutation = useMutation({
    mutationFn: async () => {
      const update: any = {
        telefone: form.telefone.replace(/\D/g, "") || null,
        whatsapp: form.whatsapp.replace(/\D/g, "") || null,
        email: form.email || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep || null,
        responsavel_interno: form.responsavel_interno || null,
        observacoes: form.observacoes || null,
      };
      if (isPF) {
        update.nome_completo = form.nome_completo || null;
      } else {
        update.razao_social = form.razao_social || null;
        update.nome_fantasia = form.nome_fantasia || null;
        update.inscricao_estadual = form.inscricao_estadual || null;
        update.inscricao_municipal = form.inscricao_municipal || null;
      }
      const { error } = await supabase.from("clientes").update(update).eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", cliente.id] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente atualizado");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const handleAddressFound = (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((prev) => ({ ...prev, ...address }));
    toast.success("Endereço preenchido");
  };

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="Editar Cliente" size="xl">
      <div className="space-y-6">
        {isPF ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
            <TextInput label="Nome completo" value={form.nome_completo} onChange={(e) => setForm((p) => ({ ...p, nome_completo: e.target.value }))} icon={<UserRound className="w-4 h-4" />} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados da empresa</p>
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Razão Social" value={form.razao_social} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} icon={<Building2 className="w-4 h-4" />} />
              <TextInput label="Nome Fantasia" value={form.nome_fantasia} onChange={(e) => setForm((p) => ({ ...p, nome_fantasia: e.target.value }))} />
              <TextInput label="Inscrição Estadual" value={form.inscricao_estadual} onChange={(e) => setForm((p) => ({ ...p, inscricao_estadual: e.target.value }))} />
              <TextInput label="Inscrição Municipal" value={form.inscricao_municipal} onChange={(e) => setForm((p) => ({ ...p, inscricao_municipal: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput label="Telefone" value={form.telefone} onValueChange={(v) => setForm((p) => ({ ...p, telefone: v }))} />
            <PhoneInput label="WhatsApp" value={form.whatsapp} onValueChange={(v) => setForm((p) => ({ ...p, whatsapp: v }))} />
            <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} icon={<Mail className="w-4 h-4" />} />
          </div>
        </div>

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
          <div className="grid grid-cols-3 gap-4">
            <CepInput value={form.cep} onValueChange={(v) => setForm((p) => ({ ...p, cep: v }))} onAddressFound={handleAddressFound} />
            <TextInput label="Logradouro" value={form.logradouro} onChange={(e) => setForm((p) => ({ ...p, logradouro: e.target.value }))} icon={<Home className="w-4 h-4" />} />
            <TextInput label="Número" value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <TextInput label="Complemento" value={form.complemento} onChange={(e) => setForm((p) => ({ ...p, complemento: e.target.value }))} />
            <TextInput label="Bairro" value={form.bairro} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))} />
            <TextInput label="Cidade" value={form.cidade} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} icon={<MapPin className="w-4 h-4" />} />
            <TextInput label="Estado" value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} />
          </div>
        </div>

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações internas</p>
          <TextInput label="Responsável interno" value={form.responsavel_interno} onChange={(e) => setForm((p) => ({ ...p, responsavel_interno: e.target.value }))} />
          <TextareaInput label="Observações" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-lg gap-2 shadow-sm">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
