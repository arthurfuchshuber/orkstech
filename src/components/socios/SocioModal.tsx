import { useEffect, useState } from "react";
import { Users, User, MapPin, Landmark, Briefcase, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DocumentInput, PhoneInput, CepInput, DateInput, PercentInput } from "@/components/inputs";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { BancoModal } from "@/components/modals/BancoModal";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { refreshQueries } from "@/lib/query-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface SocioModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  socioId?: string | null;
  onSaved?: (id: string) => void;
}

interface SocioForm {
  tipo_pessoa: "PF" | "PJ"; documento: string; origem: "manual" | "receita_federal"; qualificacao: string;
  nome_completo: string; cpf: string; rg: string; data_nascimento?: Date;
  email: string; telefone: string;
  cargo: string; percentual_participacao: number; data_entrada?: Date; administrador: boolean;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
  banco: string; agencia: string; conta: string; tipo_conta: string;
  pix_tipo: string; pix_chave: string;
  notas: string; ativo: boolean;
}

const initial: SocioForm = {
  tipo_pessoa: "PF", documento: "", origem: "manual", qualificacao: "",
  nome_completo: "", cpf: "", rg: "", data_nascimento: undefined,
  email: "", telefone: "",
  cargo: "", percentual_participacao: 0, data_entrada: undefined, administrador: false,
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  banco: "", agencia: "", conta: "", tipo_conta: "",
  pix_tipo: "", pix_chave: "",
  notas: "", ativo: true,
};

const SectionTitle = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex items-center gap-2 pt-2">
    <Icon className="h-4 w-4 text-primary" />
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-xs font-medium text-muted-foreground">{children}</label>
);

export function SocioModal({ open, onOpenChange, socioId, onSaved }: SocioModalProps) {
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SocioForm>(initial);
  const [saving, setSaving] = useState(false);
  const [bancoModalOpen, setBancoModalOpen] = useState(false);
  const [bancoEditingId, setBancoEditingId] = useState<string | null>(null);
  const bancosCrud = useManagedSelect("bancos");

  useEffect(() => {
    if (user && open) {
      supabase.rpc("seed_default_bancos", { p_user_id: user.id }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["bancos"] });
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

  const bancoOptions = (bancos as any[]).map((b) => ({
    value: b.codigo ? `${b.codigo} - ${b.nome}` : b.nome,
    label: b.codigo ? `${b.codigo} - ${b.nome}` : b.nome,
  }));

  const set = <K extends keyof SocioForm>(k: K, v: SocioForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (!socioId) { setForm(initial); return; }
    (async () => {
      const { data, error } = await supabase.from("empresa_socios").select("*").eq("id", socioId).maybeSingle();
      if (error || !data) { toast.error("Não foi possível carregar o sócio"); return; }
      setForm({
        tipo_pessoa: (data.tipo_pessoa as "PF" | "PJ") ?? "PF",
        documento: data.documento ?? data.cpf ?? "",
        origem: (data.origem as "manual" | "receita_federal") ?? "manual",
        qualificacao: data.qualificacao ?? "",
        nome_completo: data.nome_completo ?? "", cpf: data.cpf ?? "", rg: data.rg ?? "",
        data_nascimento: data.data_nascimento ? new Date(data.data_nascimento + "T00:00:00") : undefined,
        email: data.email ?? "", telefone: data.telefone ?? "",
        cargo: data.cargo ?? "", percentual_participacao: Number(data.percentual_participacao ?? 0),
        data_entrada: data.data_entrada ? new Date(data.data_entrada + "T00:00:00") : undefined,
        administrador: !!data.administrador,
        cep: data.cep ?? "", logradouro: data.logradouro ?? "", numero: data.numero ?? "",
        complemento: data.complemento ?? "", bairro: data.bairro ?? "", cidade: data.cidade ?? "", estado: data.estado ?? "",
        banco: data.banco ?? "", agencia: data.agencia ?? "", conta: data.conta ?? "", tipo_conta: data.tipo_conta ?? "",
        pix_tipo: data.pix_tipo ?? "", pix_chave: data.pix_chave ?? "",
        notas: data.notas ?? "", ativo: data.ativo ?? true,
      });
    })();
  }, [open, socioId]);

  const handleCep = (addr: any) => {
    if (addr?.logradouro) set("logradouro", addr.logradouro);
    if (addr?.bairro) set("bairro", addr.bairro);
    if (addr?.cidade || addr?.localidade) set("cidade", addr.cidade || addr.localidade);
    if (addr?.estado || addr?.uf) set("estado", addr.estado || addr.uf);
  };

  const handleSave = async () => {
    if (!form.nome_completo.trim()) { toast.error("Nome do sócio é obrigatório"); return; }
    if (!empresa?.id || !user?.id) { toast.error("Empresa não selecionada"); return; }

    // Validação: soma dos percentuais não pode passar de 100%
    const novoPercentual = Number(form.percentual_participacao) || 0;
    if (novoPercentual < 0 || novoPercentual > 100) {
      toast.error("Percentual deve estar entre 0% e 100%");
      return;
    }
    if (novoPercentual > 0) {
      const { data: outros } = await supabase
        .from("empresa_socios")
        .select("id, percentual_participacao, status_socio, ativo")
        .eq("empresa_id", empresa.id);
      const somaOutros = (outros ?? [])
        .filter((s: any) => s.id !== socioId && s.status_socio !== "inativo" && s.ativo !== false)
        .reduce((acc: number, s: any) => acc + (Number(s.percentual_participacao) || 0), 0);
      const total = somaOutros + novoPercentual;
      if (total > 100.01) {
        const disponivel = Math.max(0, 100 - somaOutros);
        toast.error("Soma dos percentuais excede 100%", {
          description: `Já existem ${somaOutros.toFixed(2)}% distribuídos. Máximo disponível para este sócio: ${disponivel.toFixed(2)}%.`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      const docDigits = (form.documento || form.cpf || "").replace(/\D/g, "");
      const payload: any = {
        empresa_id: empresa.id, user_id: user.id,
        tipo_pessoa: form.tipo_pessoa,
        documento: docDigits || null,
        qualificacao: form.qualificacao || null,
        origem: form.origem,
        nome_completo: form.nome_completo.trim(),
        cpf: form.tipo_pessoa === "PF" ? (docDigits || form.cpf || null) : null,
        rg: form.rg || null,
        data_nascimento: form.data_nascimento ? form.data_nascimento.toISOString().slice(0, 10) : null,
        email: form.email || null, telefone: form.telefone || null,
        cargo: form.cargo || null, percentual_participacao: form.percentual_participacao || 0,
        data_entrada: form.data_entrada ? form.data_entrada.toISOString().slice(0, 10) : null,
        administrador: form.administrador,
        cep: form.cep || null, logradouro: form.logradouro || null, numero: form.numero || null,
        complemento: form.complemento || null, bairro: form.bairro || null, cidade: form.cidade || null, estado: form.estado || null,
        banco: form.banco || null, agencia: form.agencia || null, conta: form.conta || null, tipo_conta: form.tipo_conta || null,
        pix_tipo: form.pix_tipo || null, pix_chave: form.pix_chave || null,
        notas: form.notas || null, ativo: form.ativo,
      };
      let savedId = socioId ?? "";
      if (socioId) {
        const { error } = await supabase.from("empresa_socios").update(payload).eq("id", socioId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("empresa_socios").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
      }
      toast.success(socioId ? "Sócio atualizado" : "Sócio cadastrado");
      await refreshQueries(queryClient, [["empresa_socios"]]);
      onSaved?.(savedId);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar sócio");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
            {socioId ? "Editar Sócio" : "Novo Sócio"}
            {form.origem === "receita_federal" && (
              <Badge variant="outline" className="gap-1 text-[10px] border-primary/30 text-primary bg-primary/5">
                <ShieldCheck className="h-3 w-3" /> Receita Federal
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Tipo de Pessoa */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "PF")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${form.tipo_pessoa === "PF" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}
            >
              <User className="h-4 w-4" /> Pessoa Física
            </button>
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "PJ")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${form.tipo_pessoa === "PJ" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"}`}
            >
              <Building2 className="h-4 w-4" /> Pessoa Jurídica
            </button>
          </div>

          {/* Dados Pessoais */}
          <SectionTitle icon={form.tipo_pessoa === "PJ" ? Building2 : User} label={form.tipo_pessoa === "PJ" ? "Dados da Empresa Sócia" : "Dados Pessoais"} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel>{form.tipo_pessoa === "PJ" ? "Razão Social *" : "Nome completo *"}</FieldLabel>
              <Input value={form.nome_completo} maxLength={60} onChange={(e) => set("nome_completo", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              {(() => {
                const digits = (form.documento || "").replace(/\D/g, "");
                const isMaskedFromReceita =
                  form.origem === "receita_federal" &&
                  form.tipo_pessoa === "PF" &&
                  digits.length === 6;
                if (isMaskedFromReceita) {
                  const display = `***.${digits.slice(0, 3)}.${digits.slice(3)}-**`;
                  return (
                    <>
                      <FieldLabel>CPF</FieldLabel>
                      <Input
                        value={display}
                        readOnly
                        onFocus={(e) => {
                          // Ao focar, libera para edição manual (limpa para o usuário digitar o CPF completo)
                          set("documento", "");
                          e.currentTarget.blur();
                          setTimeout(() => e.currentTarget.focus(), 0);
                        }}
                        className="h-9 text-sm font-mono cursor-text"
                        title="Clique para complementar o CPF (a Receita oculta dígitos por LGPD)"
                      />
                    </>
                  );
                }
                return (
                  <DocumentInput
                    type={form.tipo_pessoa === "PJ" ? "cnpj" : "cpf"}
                    value={form.documento}
                    onValueChange={(v) => set("documento", v)}
                    label={form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}
                  />
                );
              })()}
            </div>
            {form.tipo_pessoa === "PF" ? (
              <div>
                <FieldLabel>RG</FieldLabel>
                <Input value={form.rg} maxLength={20} onChange={(e) => set("rg", e.target.value)} className="h-9 text-sm" />
              </div>
            ) : (
              <div>
                <FieldLabel>Qualificação (Receita)</FieldLabel>
                <Input value={form.qualificacao} maxLength={60} onChange={(e) => set("qualificacao", e.target.value)} className="h-9 text-sm" />
              </div>
            )}
            {form.tipo_pessoa === "PF" && (
              <DateInput label="Data de Nascimento" value={form.data_nascimento} onValueChange={(d) => set("data_nascimento", d)} />
            )}
            <div>
              <FieldLabel>E-mail</FieldLabel>
              <Input type="email" value={form.email} maxLength={60} onChange={(e) => set("email", e.target.value)} className="h-9 text-sm" />
            </div>
            <PhoneInput value={form.telefone} onValueChange={(v) => set("telefone", v)} label="Telefone" />
          </div>

          {/* Função Societária */}
          <SectionTitle icon={Briefcase} label="Função Societária" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Cargo / Função</FieldLabel>
              <Input value={form.cargo} maxLength={60} placeholder="Ex: Sócio-Diretor, CEO, Sócio-Quotista" onChange={(e) => set("cargo", e.target.value)} className="h-9 text-sm" />
            </div>
            <PercentInput label="Participação (%)" value={form.percentual_participacao} onValueChange={(v) => set("percentual_participacao", v ?? 0)} />
            <DateInput label="Data de Entrada" value={form.data_entrada} onValueChange={(d) => set("data_entrada", d)} />
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.administrador} onCheckedChange={(v) => set("administrador", v)} />
              <span className="text-sm">Administrador da empresa</span>
            </div>
          </div>

          {/* Endereço */}
          <SectionTitle icon={MapPin} label="Endereço" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CepInput value={form.cep} onValueChange={(v) => set("cep", v)} onAddressFound={handleCep} label="CEP" />
            <div>
              <FieldLabel>Logradouro</FieldLabel>
              <Input value={form.logradouro} maxLength={60} onChange={(e) => set("logradouro", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Número</FieldLabel>
              <Input value={form.numero} maxLength={10} onChange={(e) => set("numero", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Complemento</FieldLabel>
              <Input value={form.complemento} maxLength={60} onChange={(e) => set("complemento", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Bairro</FieldLabel>
              <Input value={form.bairro} maxLength={60} onChange={(e) => set("bairro", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Cidade</FieldLabel>
              <Input value={form.cidade} maxLength={60} onChange={(e) => set("cidade", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Estado</FieldLabel>
              <Input value={form.estado} maxLength={2} onChange={(e) => set("estado", e.target.value.toUpperCase())} className="h-9 text-sm" />
            </div>
          </div>

          {/* Dados Bancários */}
          <SectionTitle icon={Landmark} label="Dados Bancários" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Banco</FieldLabel>
              <Input value={form.banco} maxLength={60} onChange={(e) => set("banco", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Tipo de Conta</FieldLabel>
              <Select value={form.tipo_conta || undefined} onValueChange={(v) => set("tipo_conta", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Conta Poupança</SelectItem>
                  <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Agência</FieldLabel>
              <Input value={form.agencia} maxLength={10} onChange={(e) => set("agencia", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Conta</FieldLabel>
              <Input value={form.conta} maxLength={20} onChange={(e) => set("conta", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <FieldLabel>Tipo de Chave PIX</FieldLabel>
              <Select value={form.pix_tipo || undefined} onValueChange={(v) => set("pix_tipo", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Chave PIX</FieldLabel>
              <Input value={form.pix_chave} maxLength={60} onChange={(e) => set("pix_chave", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <FieldLabel>Observações</FieldLabel>
            <Textarea value={form.notas} maxLength={500} rows={3} onChange={(e) => set("notas", e.target.value)} className="text-sm" />
          </div>

          <div className="flex items-center gap-3 border-t pt-4">
            <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
            <span className="text-sm">Sócio ativo</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome_completo.trim()}>
            {saving ? "Salvando..." : socioId ? "Salvar Alterações" : "Cadastrar Sócio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
