import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Search, Clock, Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

interface Company {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  owner_email: string;
  created_at: string;
  trial_end: string | null;
  is_manual_trial: boolean;
  subscription_status: string | null;
  stats: { payables: number; receivables: number; clientes: number };
}

function TrialBadge({ company }: { company: Company }) {
  if (company.is_manual_trial && company.trial_end) {
    const daysLeft = differenceInDays(new Date(company.trial_end), new Date());
    if (daysLeft < 0) {
      return <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground">Trial expirado</Badge>;
    }
    return (
      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
        Trial: {daysLeft}d restante{daysLeft === 1 ? "" : "s"}
      </Badge>
    );
  }
  if (company.subscription_status === "active") {
    return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Ativo</Badge>;
  }
  if (company.subscription_status === "trialing") {
    return <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Trial Stripe</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] bg-muted/20 text-muted-foreground">—</Badge>;
}

function TrialDialog({
  company, open, onOpenChange,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [days, setDays] = useState<string>("14");

  const mutation = useMutation({
    mutationFn: async ({ empresa_id, days }: { empresa_id: string; days: number }) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "set_manual_trial", empresa_id, days },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Período de teste atualizado");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao definir trial"),
  });

  if (!company) return null;
  const numericDays = parseInt(days, 10);
  const isValid = !isNaN(numericDays) && numericDays >= 0 && numericDays <= 3650;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" /> Definir período de teste
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define quantos dias de trial <strong>{company.nome_fantasia || company.razao_social}</strong> terá a partir de hoje. Use <strong>0</strong> para encerrar o trial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {company.is_manual_trial && company.trial_end && (
            <div className="rounded-md border border-border/40 bg-muted/20 p-2.5 text-xs">
              <p className="text-muted-foreground">Trial atual encerra em:</p>
              <p className="font-medium text-foreground">
                {format(new Date(company.trial_end), "dd/MM/yyyy 'às' HH:mm")}
                {" — "}
                {Math.max(0, differenceInDays(new Date(company.trial_end), new Date()))} dia(s) restantes
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="trial-days" className="text-xs">Dias de teste</Label>
            <Input
              id="trial-days"
              type="number"
              min={0}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Ex: 14, 30, 60..."
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              {isValid && numericDays > 0
                ? `Encerra em ${format(new Date(Date.now() + numericDays * 86400000), "dd/MM/yyyy")}`
                : numericDays === 0
                ? "O trial será encerrado imediatamente"
                : "Informe um valor entre 0 e 3650"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!isValid || mutation.isPending}
            onClick={() => mutation.mutate({ empresa_id: company.id, days: numericDays })}
          >
            {mutation.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCompanies() {
  const [search, setSearch] = useState("");
  const [trialCompany, setTrialCompany] = useState<Company | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_companies" } });
      if (error) throw error;
      return data.companies as Company[];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return data ?? [];
    const s = search.toLowerCase();
    return (data ?? []).filter((c) =>
      (c.razao_social?.toLowerCase().includes(s)) ||
      (c.nome_fantasia?.toLowerCase().includes(s)) ||
      (c.cnpj?.includes(s)) ||
      (c.owner_email?.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar empresa, CNPJ ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} empresas</Badge>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Empresas cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">Empresa</TableHead>
                  <TableHead className="w-[13%]">CNPJ</TableHead>
                  <TableHead className="w-[20%]">Dono (e-mail)</TableHead>
                  <TableHead className="w-[13%]">Assinatura</TableHead>
                  <TableHead className="w-[10%]">Lanç.</TableHead>
                  <TableHead className="w-[10%]">Criada</TableHead>
                  <TableHead className="w-[10%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !filtered.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground truncate">{c.nome_fantasia || c.razao_social}</p>
                      {c.nome_fantasia && <p className="text-[10px] text-muted-foreground truncate">{c.razao_social}</p>}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{c.owner_email}</TableCell>
                    <TableCell><TrialBadge company={c} /></TableCell>
                    <TableCell className="text-xs">
                      <span className="text-foreground">{(c.stats?.payables ?? 0) + (c.stats?.receivables ?? 0)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setTrialCompany(c)}
                      >
                        <Clock className="w-3 h-3" /> Trial
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TrialDialog
        company={trialCompany}
        open={!!trialCompany}
        onOpenChange={(open) => !open && setTrialCompany(null)}
      />
    </div>
  );
}
