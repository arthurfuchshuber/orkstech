import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Pencil, Loader2, Plus, X, Star } from "lucide-react";
import { toast } from "sonner";
import { PricingCards } from "@/components/billing/PricingCards";
import { usePlans, type Plan } from "@/hooks/usePlans";

interface PlanOverride {
  product_id: string;
  display_name: string | null;
  tagline: string | null;
  description: string | null;
  features: string[];
  highlight: boolean;
}

export default function AdminPlans() {
  const qc = useQueryClient();
  const { data: plans } = usePlans();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanOverride>({
    product_id: "", display_name: "", tagline: "", description: "", features: [], highlight: false,
  });
  const [newFeature, setNewFeature] = useState("");

  const { data: subsData } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_subscriptions" } });
      if (error) throw error;
      return data.subscriptions as any[];
    },
  });

  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const upsertMutation = useMutation({
    mutationFn: async (payload: PlanOverride) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "upsert_plan_override", ...payload },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano atualizado — refletido na visão do cliente");
      qc.invalidateQueries({ queryKey: ["stripe-plans"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      product_id: plan.product_id,
      display_name: plan.name,
      tagline: plan.tagline ?? "",
      description: plan.description ?? "",
      features: plan.features ?? [],
      highlight: plan.highlight,
    });
  };

  // Agg subscribers/MRR per plan
  const aggByProduct: Record<string, { count: number; mrr: number }> = {};
  for (const s of subsData ?? []) {
    if (s.status !== "active") continue;
    const monthly = s.interval === "year"
      ? Math.round(s.amount / 12)
      : s.interval === "month" && s.interval_count > 1
      ? Math.round(s.amount / s.interval_count)
      : s.amount;
    if (!aggByProduct[s.product_id]) aggByProduct[s.product_id] = { count: 0, mrr: 0 };
    aggByProduct[s.product_id].count++;
    aggByProduct[s.product_id].mrr += monthly;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Métricas por plano (admin) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Métricas por Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans?.map((plan) => {
              const agg = aggByProduct[plan.product_id] ?? { count: 0, mrr: 0 };
              return (
                <div key={plan.product_id} className="p-4 rounded-lg bg-muted/30 border border-border/40 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                        {plan.highlight && <Star className="w-3 h-3 text-primary fill-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{plan.product_id}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Assinantes</p>
                      <p className="text-lg font-bold text-primary">{agg.count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">MRR</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(agg.mrr)}</p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] text-muted-foreground">Mensal: <span className="text-foreground">{plan.prices.monthly ? fmt(plan.prices.monthly.amount) : "—"}</span></p>
                    <p className="text-[10px] text-muted-foreground">Semestral: <span className="text-foreground">{plan.prices.semiannual ? fmt(plan.prices.semiannual.amount) : "—"}</span></p>
                    <p className="text-[10px] text-muted-foreground">Anual: <span className="text-foreground">{plan.prices.annual ? fmt(plan.prices.annual.amount) : "—"}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pré-visualização (visão do cliente) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pré-visualização (visão do cliente)</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingCards publicMode />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Plano: {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Nome de exibição</label>
              <Input value={form.display_name ?? ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={60} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tagline (subtítulo)</label>
              <Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição completa</label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={300} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Funcionalidades</label>
              <div className="space-y-1.5 mt-1">
                {form.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={f} onChange={(e) => {
                      const next = [...form.features]; next[i] = e.target.value; setForm({ ...form, features: next });
                    }} maxLength={60} />
                    <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, features: form.features.filter((_, idx) => idx !== i) })}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="Nova funcionalidade..." maxLength={60} />
                  <Button size="sm" onClick={() => { if (newFeature.trim()) { setForm({ ...form, features: [...form.features, newFeature.trim()] }); setNewFeature(""); } }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium">Destacar como "Mais popular"</p>
                <p className="text-[10px] text-muted-foreground">Apenas um plano por vez recomendado</p>
              </div>
              <Switch checked={form.highlight} onCheckedChange={(v) => setForm({ ...form, highlight: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => upsertMutation.mutate(form)} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Salvar e publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
