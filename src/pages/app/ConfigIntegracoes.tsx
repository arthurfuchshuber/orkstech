import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Trash2, Plug, Banknote, FileSignature,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const PROVIDERS: Record<Provider, {
  nome: string;
  descricao: string;
  icon: typeof Banknote;
  webhookFn: string;
  docsUrl: string;
  ambienteSelector: boolean;
}> = {
  asaas: {
    nome: "Asaas",
    descricao: "Gere boletos, PIX e cartão de crédito automaticamente para seus lançamentos de Contas a Receber.",
    icon: Banknote,
    webhookFn: "asaas-webhook",
    docsUrl: "https://docs.asaas.com",
    ambienteSelector: true,
  },
  clicksign: {
    nome: "ClickSign",
    descricao: "Acompanhe assinaturas eletrônicas de contratos e vincule documentos assinados ao histórico do cliente.",
    icon: FileSignature,
    webhookFn: "clicksign-webhook",
    docsUrl: "https://developers.clicksign.com",
    ambienteSelector: true,
  },
};

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Conecte serviços externos para automatizar cobranças e assinaturas.
        </p>
      </div>

      {!empresa?.id ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Selecione uma empresa para configurar integrações.
        </Card>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid gap-4">
          {(Object.keys(PROVIDERS) as Provider[]).map((provider) => {
            const cfg = PROVIDERS[provider];
            const cred = credenciais.find((c) => c.provider === provider) || null;
            return (
              <IntegrationCard
                key={provider}
                provider={provider}
                cfg={cfg}
                cred={cred}
                empresaId={empresa.id}
                userId={user!.id}
                onChanged={() => qc.invalidateQueries({ queryKey: ["integracoes-credenciais", empresa.id] })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  provider: Provider;
  cfg: typeof PROVIDERS[Provider];
  cred: Credencial | null;
  empresaId: string;
  userId: string;
  onChanged: () => void;
}

function IntegrationCard({ provider, cfg, cred, empresaId, userId, onChanged }: CardProps) {
  const Icon = cfg.icon;
  const [editing, setEditing] = useState(!cred);
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<"sandbox" | "production">(cred?.ambiente || "production");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const webhookUrl = cred?.webhook_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${cfg.webhookFn}?token=${cred.webhook_token}`
    : "";

  const apiFunctionName = provider === "asaas" ? "asaas-api" : "clicksign-api";

  const test = async () => {
    if (!apiKey) {
      toast.error("Informe a chave de API antes de testar");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke(apiFunctionName, {
        body: { action: "test", api_key: apiKey, ambiente },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`${cfg.nome} conectado com sucesso!`);
    } catch (e) {
      toast.error(`Falha na validação: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!apiKey) {
      toast.error("Informe a chave de API");
      return;
    }
    setSaving(true);
    try {
      // Test first
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
        const { error } = await supabase
          .from("integracoes_credenciais")
          .update(payload)
          .eq("id", cred.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integracoes_credenciais")
          .insert(payload);
        if (error) throw error;
      }

      toast.success(`${cfg.nome} salvo e validado!`);
      setApiKey("");
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (checked: boolean) => {
    if (!cred) return;
    const { error } = await supabase
      .from("integracoes_credenciais")
      .update({ ativo: checked })
      .eq("id", cred.id);
    if (error) toast.error("Erro ao atualizar");
    else {
      toast.success(checked ? "Integração ativada" : "Integração desativada");
      onChanged();
    }
  };

  const remove = async () => {
    if (!cred) return;
    const { error } = await supabase.from("integracoes_credenciais").delete().eq("id", cred.id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Integração removida");
      onChanged();
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{cfg.nome}</h3>
              {cred?.ativo ? (
                <Badge variant="default" className="bg-green-500/15 text-green-600 hover:bg-green-500/20 border-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
                </Badge>
              ) : cred ? (
                <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" /> Pausado</Badge>
              ) : (
                <Badge variant="outline">Não configurado</Badge>
              )}
              {cred && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {cred.ambiente === "sandbox" ? "Sandbox" : "Produção"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{cfg.descricao}</p>
            <a
              href={cfg.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Documentação →
            </a>
          </div>
        </div>

        {cred && !editing && (
          <div className="flex items-center gap-3">
            <Switch checked={cred.ativo} onCheckedChange={toggleAtivo} />
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="w-4 h-4" />
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
        )}
      </div>

      {editing ? (
        <div className="space-y-4 pt-2 border-t border-border">
          {cfg.ambienteSelector && (
            <div>
              <Label className="text-xs">Ambiente</Label>
              <div className="flex gap-2 mt-1.5">
                {(["production", "sandbox"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmbiente(a)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      ambiente === a
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    {a === "production" ? "Produção" : "Sandbox"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label htmlFor={`apikey-${provider}`} className="text-xs">
              Chave de API ({cfg.nome})
            </Label>
            <div className="relative mt-1.5">
              <Input
                id={`apikey-${provider}`}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={cred ? "Deixe em branco para manter a atual" : "Cole sua chave de API aqui"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {cred && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Atual: <span className="font-mono">{maskKey(cred.api_key)}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={save} disabled={saving || (!apiKey && !cred)}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Salvar e validar
            </Button>
            <Button variant="outline" onClick={test} disabled={testing || !apiKey}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Testar conexão
            </Button>
            {cred && (
              <Button variant="ghost" onClick={() => { setEditing(false); setApiKey(""); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : cred && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <Webhook className="w-3 h-3" /> URL do Webhook
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyWebhook}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Cole essa URL no painel da {cfg.nome} para receber atualizações automáticas em tempo real.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
