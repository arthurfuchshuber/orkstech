import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useIntegrationNotifPrefs, IntegrationProvider } from "@/hooks/useIntegrationNotifPrefs";
import { AlertTriangle, BellOff, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Failure {
  provider: IntegrationProvider;
  label: string;
  detail: string;
}

const SEEN_KEY = "integration_failure_popup_seen_v1";

function loadSeen(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}
function markSeen(provider: string) {
  const seen = loadSeen();
  seen[provider] = Date.now();
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export function IntegrationFailureBanner() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { getPref, update } = useIntegrationNotifPrefs();
  const [popupFor, setPopupFor] = useState<Failure | null>(null);
  const [prefsOpen, setPrefsOpen] = useState<IntegrationProvider | null>(null);

  // Pluggy: conexões com status diferente de connected/disabled
  const { data: pluggyFails = [] } = useQuery({
    queryKey: ["pluggy_failures", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("pluggy_connections" as any)
        .select("connector_name, status")
        .eq("user_id", user.id)
        .in("status", ["login_required", "outdated", "error"]);
      return (data ?? []) as any[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Asaas/ClickSign: credenciais ativas mas com falha de validação
  const { data: credFails = [] } = useQuery({
    queryKey: ["integ_creds_failures", empresa?.id],
    queryFn: async () => {
      if (!empresa?.id) return [];
      const { data } = await supabase
        .from("integracoes_credenciais")
        .select("provider, ativo, ultima_validacao, last_error")
        .eq("empresa_id", empresa.id);
      return (data ?? []).filter((c: any) => c.ativo && c.last_error) as any[];
    },
    enabled: !!empresa?.id,
    refetchInterval: 60_000,
  });

  const failures: Failure[] = [
    ...pluggyFails.map((p: any) => ({
      provider: "pluggy" as const,
      label: p.connector_name || "Open Finance",
      detail: p.status === "login_required"
        ? "Reautenticação necessária — o banco exige novo login."
        : p.status === "outdated"
        ? "Sincronização desatualizada — tente reconectar."
        : "Erro na conexão.",
    })),
    ...credFails.map((c: any) => ({
      provider: c.provider as IntegrationProvider,
      label: c.provider === "asaas" ? "Asaas" : "ClickSign",
      detail: c.last_error || "Falha na última validação da credencial.",
    })),
  ];

  // Popup + sino: 1x por janela de 6h por provider, respeitando silenciamento
  useEffect(() => {
    if (!failures.length || !user) return;
    const seen = loadSeen();
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    for (const f of failures) {
      const pref = getPref(f.provider);
      const stale = Date.now() - (seen[f.provider] || 0) >= SIX_HOURS;
      if (!stale) continue;

      if (!pref.silenced_popup && !popupFor) setPopupFor(f);

      if (!pref.silenced_bell) {
        supabase.from("notificacoes_sistema").insert({
          user_id: user.id,
          titulo: `${f.label}: integração com problema`,
          descricao: `${f.detail} Seus dados sincronizados estão preservados.`,
          tipo: "alerta",
          entidade_tipo: "integracao",
        }).then(() => {});
      }

      markSeen(f.provider);
    }
  }, [failures.length, user?.id]);

  const visibleBanners = failures.filter((f) => !getPref(f.provider).silenced_banner);

  return (
    <>
      {visibleBanners.length > 0 && (
        <div className="space-y-1.5 px-3 pt-3">
          {visibleBanners.map((f) => (
            <div
              key={f.provider + f.label}
              className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {f.label}: integração com problema
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{f.detail} Seus dados estão preservados.</p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
                <Link to="/app/config/integracoes">Resolver</Link>
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                title="Preferências de notificação"
                onClick={() => setPrefsOpen(f.provider)}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Popup de primeira detecção */}
      <Dialog open={!!popupFor} onOpenChange={(v) => !v && setPopupFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Integração com problema
            </DialogTitle>
          </DialogHeader>
          {popupFor && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-foreground">
                <strong>{popupFor.label}</strong> — {popupFor.detail}
              </p>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                ✅ Seus dados sincronizados <strong className="text-foreground">continuam preservados</strong>.
                Você pode reconectar a integração ou, se preferir, removê-la decidindo manter ou excluir os dados.
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (popupFor) {
                  const pref = getPref(popupFor.provider);
                  update.mutate({ ...pref, silenced_popup: true });
                  toast.success("Pop-ups silenciados para esta integração");
                }
                setPopupFor(null);
              }}
              className="gap-1.5"
            >
              <BellOff className="w-3.5 h-3.5" /> Não mostrar mais
            </Button>
            <Button onClick={() => setPopupFor(null)} variant="outline">Depois</Button>
            <Button asChild>
              <Link to="/app/config/integracoes" onClick={() => setPopupFor(null)}>Resolver agora</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preferências de silenciamento */}
      <Dialog open={!!prefsOpen} onOpenChange={(v) => !v && setPrefsOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Notificações de falha</DialogTitle>
          </DialogHeader>
          {prefsOpen && (() => {
            const pref = getPref(prefsOpen);
            const Row = ({ k, label, desc }: { k: keyof typeof pref; label: string; desc: string }) => (
              <div className="flex items-start justify-between gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={!(pref as any)[k]}
                  onCheckedChange={(v) => update.mutate({ ...pref, [k]: !v })}
                />
              </div>
            );
            return (
              <div className="divide-y divide-border">
                <Row k="silenced_popup" label="Pop-up de aviso" desc="Modal na primeira detecção da falha." />
                <Row k="silenced_banner" label="Banner persistente" desc="Aviso fixo no topo até resolver." />
                <Row k="silenced_bell" label="Sino de notificações" desc="Entrada no centro de notificações." />
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setPrefsOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
