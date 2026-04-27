import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, XCircle, Copy, Webhook, Eye, EyeOff,
  Trash2, Plug, Banknote, FileSignature, ChevronDown, Clock, Sparkles,
  Building2, MessageCircle, Mail, BarChart3, Search,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Provider = "asaas" | "clicksign";

interface Credencial {
  id: string;
  provider: Provider;
  api_key: string;
  ambiente: "sandbox" | "production";
  webhook_token: string | null;
  ativo: boolean;
  ultima_validacao: string | null;
}

interface ProviderConfig {
  nome: string;
  descricao: string;
  categoria: "Pagamentos" | "Documentos" | "Comunicação" | "Analytics" | "Outros";
  icon: typeof Banknote;
  webhookFn: string;
  docsUrl: string;
  ambienteSelector: boolean;
  status: "available" | "coming_soon";
}

const PROVIDERS: Record<string, ProviderConfig> = {
  asaas: {
    nome: "Asaas",
    descricao: "Boletos, PIX e cartão de crédito automáticos no Contas a Receber.",
    categoria: "Pagamentos",
    icon: Banknote,
    webhookFn: "asaas-webhook",
    docsUrl: "https://docs.asaas.com",
    ambienteSelector: true,
    status: "available",
  },
  clicksign: {
    nome: "ClickSign",
    descricao: "Assinaturas eletrônicas vinculadas ao histórico do cliente.",
    categoria: "Documentos",
    icon: FileSignature,
    webhookFn: "clicksign-webhook",
    docsUrl: "https://developers.clicksign.com",
    ambienteSelector: true,
    status: "available",
  },
  stripe: {
    nome: "Stripe",
    descricao: "Cobranças internacionais, assinaturas e checkout em múltiplas moedas.",
    categoria: "Pagamentos",
    icon: Banknote,
    webhookFn: "stripe-webhook",
    docsUrl: "https://stripe.com/docs",
    ambienteSelector: true,
    status: "coming_soon",
  },
  whatsapp: {
    nome: "WhatsApp Business",
    descricao: "Disparo automático de cobranças e notificações via WhatsApp.",
    categoria: "Comunicação",
    icon: MessageCircle,
    webhookFn: "whatsapp-webhook",
    docsUrl: "https://developers.facebook.com/docs/whatsapp",
    ambienteSelector: false,
    status: "coming_soon",
  },
  sendgrid: {
    nome: "SendGrid",
    descricao: "Envio profissional de e-mails transacionais e marketing.",
    categoria: "Comunicação",
    icon: Mail,
    webhookFn: "sendgrid-webhook",
    docsUrl: "https://docs.sendgrid.com",
    ambienteSelector: false,
    status: "coming_soon",
  },
  receita: {
    nome: "Receita Federal",
    descricao: "Consulta avançada de CNPJ/CPF com dados oficiais e situação cadastral.",
    categoria: "Outros",
    icon: Building2,
    webhookFn: "",
    docsUrl: "",
    ambienteSelector: false,
    status: "coming_soon",
  },
  ga4: {
    nome: "Google Analytics 4",
    descricao: "Métricas de uso e conversão do seu negócio em tempo real.",
    categoria: "Analytics",
    icon: BarChart3,
    webhookFn: "",
    docsUrl: "https://analytics.google.com",
    ambienteSelector: false,
    status: "coming_soon",
  },
};

type FilterKey = "todas" | "ativas" | "inativas" | "em_breve";

const FILTERS: { key: FilterKey; label: string; icon: typeof Plug }[] = [
  { key: "todas", label: "Todas", icon: Plug },
  { key: "ativas", label: "Ativas", icon: CheckCircle2 },
  { key: "inativas", label: "Inativas", icon: XCircle },
  { key: "em_breve", label: "Em breve", icon: Clock },
];

function maskKey(key: string) {
  if (!key) return "";
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export default function ConfigIntegracoes() {
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const userEmail = user?.email?.trim().toLowerCase() || "";

  const handleSearchChange = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("@") || (userEmail && normalized === userEmail)) {
      setSearch("");
      return;
    }
    setSearch(value);
  };

  const toggleExpanded = (key: string) => {
    if (search.includes("@")) setSearch("");
    setExpandedId(expandedId === key ? null : key);
  };

  const { data: credenciais = [], isLoading } = useQuery({
    queryKey: ["integracoes-credenciais", empresa?.id],
    queryFn: async () => {
      if (!empresa?.id) return [];
      const { data, error } = await supabase
        .from("integracoes_credenciais")
        .select("*")
        .eq("empresa_id", empresa.id);
      if (error) throw error;
      return data as Credencial[];
    },
    enabled: !!empresa?.id,
  });

  const items = useMemo(() => {
    return Object.entries(PROVIDERS).map(([key, cfg]) => {
      const cred = credenciais.find((c) => c.provider === key) || null;
      let statusKey: "ativa" | "inativa" | "em_breve" | "nao_configurada" = "nao_configurada";
      if (cfg.status === "coming_soon") statusKey = "em_breve";
      else if (cred?.ativo) statusKey = "ativa";
      else if (cred && !cred.ativo) statusKey = "inativa";
      return { key, cfg, cred, statusKey };
    });
  }, [credenciais]);

  const counts = useMemo(() => ({
    todas: items.length,
    ativas: items.filter((i) => i.statusKey === "ativa").length,
    inativas: items.filter((i) => i.statusKey === "inativa" || i.statusKey === "nao_configurada").length,
    em_breve: items.filter((i) => i.statusKey === "em_breve").length,
  }), [items]);

  const filtered = items.filter((i) => {
    if (filter === "ativas" && i.statusKey !== "ativa") return false;
    if (filter === "inativas" && i.statusKey !== "inativa" && i.statusKey !== "nao_configurada") return false;
    if (filter === "em_breve" && i.statusKey !== "em_breve") return false;
    if (search) {
      const s = search.toLowerCase();
      if (!i.cfg.nome.toLowerCase().includes(s) && !i.cfg.descricao.toLowerCase().includes(s) && !i.cfg.categoria.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Integrações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Conecte serviços externos para automatizar cobranças, assinaturas e comunicações.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar integração…"
            className="pl-9 h-9"
            type="text"
            name="integration-filter"
            autoComplete="new-password"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>
      </div>

      {/* Filtros estilo botões */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          const count = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
              <span className={cn(
                "ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold",
                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {!empresa?.id ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Selecione uma empresa para configurar integrações.
        </Card>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma integração encontrada com esses filtros.
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <IntegrationCard
              key={item.key}
              providerKey={item.key}
              cfg={item.cfg}
              cred={item.cred}
              statusKey={item.statusKey}
              expanded={expandedId === item.key}
              onToggleExpand={() => toggleExpanded(item.key)}
              empresaId={empresa.id}
              userId={user!.id}
              onChanged={() => qc.invalidateQueries({ queryKey: ["integracoes-credenciais", empresa.id] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  providerKey: string;
  cfg: ProviderConfig;
  cred: Credencial | null;
  statusKey: "ativa" | "inativa" | "em_breve" | "nao_configurada";
  expanded: boolean;
  onToggleExpand: () => void;
  empresaId: string;
  userId: string;
  onChanged: () => void;
}

function IntegrationCard({
  providerKey, cfg, cred, statusKey, expanded, onToggleExpand, empresaId, userId, onChanged,
}: CardProps) {
  const Icon = cfg.icon;
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<"sandbox" | "production">(cred?.ambiente || "production");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const isComingSoon = cfg.status === "coming_soon";
  const provider = providerKey as Provider;

  const webhookUrl = cred?.webhook_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${cfg.webhookFn}?token=${cred.webhook_token}`
    : "";

  const apiFunctionName = provider === "asaas" ? "asaas-api" : "clicksign-api";

  const test = async () => {
    if (!apiKey) { toast.error("Informe a chave de API antes de testar"); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke(apiFunctionName, {
        body: { action: "test", api_key: apiKey, ambiente },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`${cfg.nome} conectado com sucesso!`);
    } catch (e) {
      toast.error(`Falha na validação: ${(e as Error).message}`);
    } finally { setTesting(false); }
  };

  const syncAsaasHistory = async () => {
    if (provider !== "asaas") return;
    try {
      toast.info("Sincronizando histórico do Asaas…", { id: "asaas-sync" });
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "sync_history", empresa_id: empresaId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const ins = data?.inserted ?? 0;
      const upd = data?.updated ?? 0;
      toast.success(`Histórico sincronizado: ${ins} novas, ${upd} atualizadas`, { id: "asaas-sync" });
    } catch (e) {
      toast.error(`Falha ao sincronizar histórico: ${(e as Error).message}`, { id: "asaas-sync" });
    }
  };

  const syncClicksignHistory = async (createClients = false) => {
    if (provider !== "clicksign") return;
    const toastId = "cs-sync";
    try {
      toast.info(
        createClients
          ? "Importando contratantes retroativamente…"
          : "Sincronizando histórico do ClickSign…",
        { id: toastId }
      );
      const { data, error } = await supabase.functions.invoke("clicksign-sync-historico", {
        body: { empresa_id: empresaId, create_clients: createClients },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const ins = data?.inserted ?? 0;
      const upd = data?.updated ?? 0;
      const matched = data?.matched ?? 0;
      const created = data?.clients_created ?? 0;
      const linked = data?.clients_linked_by_cpf_cnpj ?? 0;
      const baseMsg = `Histórico: ${ins} novos, ${upd} atualizados, ${matched} vinculados`;
      const extra = createClients
        ? ` — ${created} clientes criados, ${linked} já existiam (vinculados)`
        : "";
      toast.success(baseMsg + extra, { id: toastId });
    } catch (e) {
      toast.error(`Falha ao sincronizar ClickSign: ${(e as Error).message}`, { id: toastId });
    }
  };

  const enrichClicksignClientes = async () => {
    if (provider !== "clicksign") return;
    const toastId = "cs-enrich";
    try {
      toast.info("Lendo contratos assinados com IA para extrair telefone e endereço…", { id: toastId });
      const { data, error } = await supabase.functions.invoke("clicksign-enrich-clientes", {
        body: { empresa_id: empresaId, only_missing: true },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const en = data?.enriched ?? 0;
      const sk = data?.skipped ?? 0;
      const fl = data?.failed ?? 0;
      toast.success(`${en} clientes enriquecidos · ${sk} sem dados a atualizar · ${fl} falhas`, { id: toastId });
    } catch (e) {
      toast.error(`Falha ao enriquecer dados: ${(e as Error).message}`, { id: toastId });
    }
  };

  const purgeAsaasHistory = async () => {
    if (provider !== "asaas") return;
    try {
      await supabase.functions.invoke("asaas-api", {
        body: { action: "purge_history", empresa_id: empresaId },
      });
    } catch (e) {
      console.warn("[asaas] purge_history falhou:", e);
    }
  };

  const save = async () => {
    if (!apiKey) { toast.error("Informe a chave de API"); return; }
    setSaving(true);
    try {
      const { data: testData, error: testErr } = await supabase.functions.invoke(apiFunctionName, {
        body: { action: "test", api_key: apiKey, ambiente },
      });
      if (testErr || testData?.error) throw new Error(testData?.error || testErr?.message || "Chave inválida");

      const payload = {
        user_id: userId,
        empresa_id: empresaId,
        provider,
        api_key: apiKey,
        ambiente,
        webhook_token: cred?.webhook_token || generateToken(),
        ativo: true,
        ultima_validacao: new Date().toISOString(),
      };

      if (cred) {
        const { error } = await supabase.from("integracoes_credenciais").update(payload).eq("id", cred.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integracoes_credenciais").insert(payload);
        if (error) throw error;
      }

      toast.success(`${cfg.nome} salvo e validado!`);
      setApiKey("");
      setEditing(false);
      onChanged();

      if (provider === "asaas") syncAsaasHistory();
      if (provider === "clicksign") syncClicksignHistory();
    } catch (e) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    } finally { setSaving(false); }
  };

  const toggleAtivo = async (checked: boolean) => {
    if (!cred) return;
    const { error } = await supabase.from("integracoes_credenciais").update({ ativo: checked }).eq("id", cred.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(checked ? "Integração ativada" : "Integração desativada");
    onChanged();
    if (provider === "asaas") {
      if (checked) syncAsaasHistory();
      else purgeAsaasHistory();
    }
    if (provider === "clicksign" && checked) {
      syncClicksignHistory();
    }
  };

  const remove = async () => {
    if (!cred) return;
    if (provider === "asaas") await purgeAsaasHistory();
    const { error } = await supabase.from("integracoes_credenciais").delete().eq("id", cred.id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Integração removida"); onChanged(); }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const StatusBadge = () => {
    if (statusKey === "em_breve") {
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[10px] whitespace-nowrap shrink-0 px-2 py-0">
          <Sparkles className="w-2.5 h-2.5" /> Em breve
        </Badge>
      );
    }
    if (statusKey === "ativa") {
      return (
        <Badge variant="default" className="bg-green-500/15 text-green-600 hover:bg-green-500/20 border-0 gap-1 text-[10px] whitespace-nowrap shrink-0 px-2 py-0">
          <CheckCircle2 className="w-2.5 h-2.5" /> Ativa
        </Badge>
      );
    }
    if (statusKey === "inativa") {
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] whitespace-nowrap shrink-0 px-2 py-0">
          <XCircle className="w-2.5 h-2.5" /> Pausada
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-[10px] whitespace-nowrap shrink-0 px-2 py-0">Não conectada</Badge>;
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all",
        expanded ? "shadow-md ring-1 ring-primary/20" : "hover:shadow-sm hover:border-border/80",
        isComingSoon && "opacity-80",
      )}
    >
      {/* Header compacto - sempre visível */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          statusKey === "ativa" ? "bg-primary/10" : "bg-muted",
        )}>
          <Icon className={cn("w-5 h-5", statusKey === "ativa" ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate leading-tight">{cfg.nome}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{cfg.categoria}</span>
            {cred?.ambiente && !isComingSoon && (
              <>
                <span className="text-muted-foreground/40 text-[10px]">•</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {cred.ambiente === "sandbox" ? "Sandbox" : "Produção"}
                </span>
              </>
            )}
            <StatusBadge />
          </div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform shrink-0",
          expanded && "rotate-180",
        )} />
      </button>

      {/* Conteúdo expansível */}
      {expanded && (
        <div className="pt-4 mt-3 border-t border-border space-y-4 animate-fade-in">
          <p className="text-xs text-muted-foreground">{cfg.descricao}</p>

          {isComingSoon ? (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              Esta integração está em desenvolvimento e estará disponível em breve.
            </div>
          ) : cred && !editing ? (
            <>
              <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                  <Switch checked={cred.ativo} onCheckedChange={toggleAtivo} />
                  <span className="text-xs text-foreground">{cred.ativo ? "Ativa" : "Pausada"}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover integração?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A chave de API será excluída. Cobranças/documentos já gerados continuam preservados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {provider === "clicksign" && cred.ativo && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => syncClicksignHistory(false)}>
                        <Loader2 className="w-3 h-3" /> Sincronizar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <Loader2 className="w-3 h-3" /> Importar contratantes
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Importar contratantes retroativamente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação irá criar automaticamente clientes no SaaS para todos os contratos finalizados
                              do ClickSign que ainda não possuem cliente cadastrado, usando os dados do signatário
                              CONTRATANTE (nome, CPF/CNPJ, email, telefone). Clientes já existentes (mesmo CPF/CNPJ)
                              serão apenas vinculados, sem duplicidade. Essa operação pode levar alguns minutos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => syncClicksignHistory(true)}>
                              Importar agora
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <Sparkles className="w-3 h-3" /> Enriquecer via IA
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Extrair telefone e endereço dos contratos?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A IA vai ler os PDFs assinados no ClickSign e preencher automaticamente
                              <strong> telefone, CEP, logradouro, bairro, cidade e estado</strong> dos
                              clientes que ainda estão com esses campos em branco. Apenas dados ausentes
                              são preenchidos — informações já cadastradas não serão sobrescritas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={enrichClicksignClientes}>
                              Extrair agora
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  {provider === "asaas" && cred.ativo && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={syncAsaasHistory}>
                      <Loader2 className="w-3 h-3" /> Sincronizar
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Webhook className="w-3 h-3" /> URL do Webhook
                </Label>
                <div className="flex gap-1.5 mt-1.5">
                  <Input value={webhookUrl} readOnly className="font-mono text-[10px] h-8" />
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyWebhook}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cole no painel da {cfg.nome} para receber atualizações em tempo real.
                </p>
              </div>

              <div className="text-[10px] text-muted-foreground">
                Chave atual: <span className="font-mono">{maskKey(cred.api_key)}</span>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {cfg.ambienteSelector && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ambiente</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {(["production", "sandbox"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmbiente(a)}
                        className={cn(
                          "px-3 py-1 rounded-md text-[11px] font-medium border transition-colors",
                          ambiente === a
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input hover:bg-accent",
                        )}
                      >
                        {a === "production" ? "Produção" : "Sandbox"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor={`apikey-${provider}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chave de API
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id={`apikey-${provider}`}
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={cred ? "Deixe em branco para manter a atual" : "Cole sua chave de API"}
                    className={cn("pr-9 h-8 text-xs", !showKey && "[text-security:disc] [-webkit-text-security:disc]")}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    name={`external-token-${provider}`}
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <Button size="sm" className="h-8 text-xs" onClick={save} disabled={saving || (!apiKey && !cred)}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plug className="w-3.5 h-3.5 mr-1" />}
                  Salvar e validar
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={test} disabled={testing || !apiKey}>
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Testar
                </Button>
                {cred && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(false); setApiKey(""); }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {cfg.docsUrl && (
            <a
              href={cfg.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline inline-block"
            >
              Documentação oficial →
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
