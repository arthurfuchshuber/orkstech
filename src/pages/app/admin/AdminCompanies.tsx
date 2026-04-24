import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2, Search, Clock, Loader2, Pencil, MoreVertical, Trash2,
  PowerOff, Power, CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { EditCompanyModal } from "@/components/admin/EditCompanyModal";

interface Company {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  owner_email: string;
  created_at: string;
  trial_end: string | null;
  is_manual_trial: boolean;
  is_complimentary: boolean;
  subscription_status: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  stats: { payables: number; receivables: number; clientes: number };
}

function SubscriptionBadge({ company }: { company: Company }) {
  // Active Stripe subscription
  if (company.subscription_status === "active") {
    return (
      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-2.5 h-2.5" /> Assinante
      </Badge>
    );
  }
  // Manual trial defined by admin
  if (company.is_manual_trial && company.trial_end) {
    const daysLeft = differenceInDays(new Date(company.trial_end), new Date());
    if (daysLeft < 0) {
      return (
        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 gap-1 whitespace-nowrap">
          <AlertCircle className="w-2.5 h-2.5" /> Trial expirado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 whitespace-nowrap">
        <Clock className="w-2.5 h-2.5" /> {daysLeft}d trial
      </Badge>
    );
  }
  // Stripe trialing
  if (company.subscription_status === "trialing") {
    return (
      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 whitespace-nowrap">
        <Sparkles className="w-2.5 h-2.5" /> Trial
      </Badge>
    );
  }
  // Sem assinatura nem trial
  return (
    <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border/50 whitespace-nowrap">
      Sem plano
    </Badge>
  );
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
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [trialCompany, setTrialCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Company | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<Company | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_companies" } });
      if (error) throw error;
      return data.companies as Company[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ empresa_id, ativo }: { empresa_id: string; ativo: boolean }) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "toggle_company_active", empresa_id, ativo },
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.ativo ? "Empresa reativada" : "Empresa inativada (todos os usuários foram desativados)");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      setToggleConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCompany = useMutation({
    mutationFn: async (empresa_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "delete_company", empresa_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa excluída");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
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

  const formatCnpj = (raw: string) => {
    const d = (raw || "").replace(/\D/g, "");
    if (d.length !== 14) return raw;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar empresa, CNPJ ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} {filtered.length === 1 ? "empresa" : "empresas"}</Badge>
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
                  <TableHead className="w-[26%]">Empresa</TableHead>
                  <TableHead className="w-[15%]">CNPJ</TableHead>
                  <TableHead className="w-[22%]">Dono (e-mail)</TableHead>
                  <TableHead className="w-[14%]">Assinatura</TableHead>
                  <TableHead className="w-[9%] text-center">Ativa</TableHead>
                  <TableHead className="w-[8%]">Criada</TableHead>
                  <TableHead className="w-[6%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !filtered.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className={!c.ativo ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.nome_fantasia || c.razao_social}</p>
                          {c.nome_fantasia && (
                            <p className="text-[10px] text-muted-foreground truncate">{c.razao_social}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{formatCnpj(c.cnpj)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{c.owner_email}</TableCell>
                    <TableCell><SubscriptionBadge company={c} /></TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={() => setToggleConfirm(c)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Editar empresa"
                          onClick={() => setEditCompany(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setTrialCompany(c)} className="text-xs gap-2">
                              <Clock className="w-3.5 h-3.5" /> Definir trial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setToggleConfirm(c)} className="text-xs gap-2">
                              {c.ativo ? (
                                <>
                                  <PowerOff className="w-3.5 h-3.5" /> Inativar empresa
                                </>
                              ) : (
                                <>
                                  <Power className="w-3.5 h-3.5" /> Reativar empresa
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(c)}
                              className="text-xs gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir empresa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditCompanyModal
        company={editCompany}
        open={!!editCompany}
        onOpenChange={(open) => !open && setEditCompany(null)}
      />

      <TrialDialog
        company={trialCompany}
        open={!!trialCompany}
        onOpenChange={(open) => !open && setTrialCompany(null)}
      />

      {/* Confirmação de inativação/reativação */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {toggleConfirm?.ativo ? (
                <PowerOff className="w-4 h-4 text-warning" />
              ) : (
                <Power className="w-4 h-4 text-success" />
              )}
              {toggleConfirm?.ativo ? "Inativar empresa?" : "Reativar empresa?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">
                <strong>{toggleConfirm?.nome_fantasia || toggleConfirm?.razao_social}</strong> será{" "}
                {toggleConfirm?.ativo ? "inativada" : "reativada"}.
              </span>
              <span className="block text-warning">
                {toggleConfirm?.ativo
                  ? "⚠ Cascade automático: todos os usuários vinculados serão desativados, e TODAS as integrações (Asaas, ClickSign, Pluggy/Open Finance), automações, regras DRE e sincronizações automáticas serão desabilitadas para impedir cobranças, webhooks ou processamentos enquanto a empresa estiver inativa."
                  : "Os usuários vinculados serão reativados e as credenciais de integrações religadas. Automações e regras DRE precisarão ser revisadas e ativadas manualmente por segurança."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toggleConfirm &&
                toggleActive.mutate({ empresa_id: toggleConfirm.id, ativo: !toggleConfirm.ativo })
              }
              className={toggleConfirm?.ativo ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}
            >
              {toggleActive.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Excluir empresa permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">
                Esta ação <strong>não pode ser desfeita</strong>. A empresa{" "}
                <strong>{deleteConfirm?.nome_fantasia || deleteConfirm?.razao_social}</strong> e{" "}
                <strong>todos os dados vinculados</strong> (clientes, fornecedores, lançamentos, contas, etc.) serão removidos permanentemente.
              </span>
              <span className="block text-destructive">
                Recomendamos <strong>inativar</strong> ao invés de excluir, sempre que possível.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteCompany.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCompany.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
