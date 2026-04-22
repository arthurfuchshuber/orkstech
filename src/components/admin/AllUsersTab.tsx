import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Building2, Pencil, Trash2, Search, ChevronRight, User, Shield } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { CompanyNameDisplay } from "./CompanyNameDisplay";
import type { AdminUser, EmpresaInfo } from "./AdminUserTypes";

interface CompanyWithUsers {
  empresa: EmpresaInfo;
  owner: AdminUser | null;
  members: AdminUser[];
}

interface Props {
  users: AdminUser[];
  isLoading: boolean;
}

export function AllUsersTab({ users, isLoading }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  // Build company-first hierarchy
  const companies = useMemo(() => {
    const empresaMap = new Map<string, CompanyWithUsers>();

    // First, gather all unique empresas from owner users
    for (const u of users) {
      if (u.is_owner) {
        for (const emp of u.empresas) {
          if (!empresaMap.has(emp.id)) {
            empresaMap.set(emp.id, { empresa: emp, owner: u, members: [] });
          }
        }
      }
    }

    // Then, assign all users to their empresa_id
    for (const u of users) {
      if (u.empresa_id && empresaMap.has(u.empresa_id)) {
        const entry = empresaMap.get(u.empresa_id)!;
        if (entry.owner?.id !== u.id) {
          entry.members.push(u);
        }
      }
    }

    let result = Array.from(empresaMap.values());

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.empresa.razao_social?.toLowerCase().includes(q) ||
          c.empresa.nome_fantasia?.toLowerCase().includes(q) ||
          c.empresa.cnpj?.includes(q) ||
          c.owner?.nome?.toLowerCase().includes(q) ||
          c.owner?.email?.toLowerCase().includes(q) ||
          c.members.some((m) => m.nome?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => new Date(b.empresa.created_at).getTime() - new Date(a.empresa.created_at).getTime());
  }, [users, searchTerm]);

  // Users without an empresa (Super Admins criados via dialog, usuários órfãos)
  const orphanUsers = useMemo(() => {
    const inCompany = new Set<string>();
    for (const u of users) {
      if (u.is_owner) inCompany.add(u.id);
      if (u.empresa_id) inCompany.add(u.id);
    }
    let result = users.filter((u) => !inCompany.has(u.id));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (u) => u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [users, searchTerm]);

  const toggleExpanded = (empresaId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(empresaId)) next.delete(empresaId);
      else next.add(empresaId);
      return next;
    });
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "toggle_user_active", user_id, ativo },
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-users"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "delete_user", user_id } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário excluído"); qc.invalidateQueries({ queryKey: ["admin-all-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (empresa_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "delete_company", empresa_id } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Empresa excluída"); qc.invalidateQueries({ queryKey: ["admin-all-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const promoteMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "promote_to_super_admin", user_id },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário promovido a Super Admin"); qc.invalidateQueries({ queryKey: ["admin-all-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por empresa, usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <Card className="overflow-hidden border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">Carregando...</TableCell></TableRow>
            ) : !companies.length && !orphanUsers.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                <div className="flex flex-col items-center gap-2"><Building2 className="w-8 h-8 text-muted-foreground/30" /><p>Nenhum usuário encontrado</p></div>
              </TableCell></TableRow>
            ) : (
              <>
              {/* Orphan users (Super Admins sem empresa, etc.) */}
              {orphanUsers.length > 0 && (
                <>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/20">
                    <TableCell colSpan={6} className="py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Sem empresa vinculada ({orphanUsers.length})
                    </TableCell>
                  </TableRow>
                  {orphanUsers.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={`orphan-${u.id}`} className="bg-muted/10 hover:bg-muted/20 border-border/10">
                        <TableCell></TableCell>
                        <TableCell colSpan={2}>
                          <div className="flex items-center gap-2.5 pl-2">
                            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 shrink-0">
                              <Shield className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{u.nome || "Sem nome"}</span>
                                <Badge variant="outline" className="text-[9px] font-normal px-1.5 py-0">{u.nivel}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(u.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Excluir usuário</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir <strong>{u.email}</strong>?</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteUserMutation.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              )}
              {companies.map((c) => {
                const isExpanded = expandedCompanies.has(c.empresa.id);
                const allUsers = [c.owner, ...c.members].filter(Boolean) as AdminUser[];
                const userCount = allUsers.length;

                return (
                  <>{/* Company row */}
                    <TableRow
                      key={c.empresa.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-border/20"
                      onClick={() => userCount > 0 && toggleExpanded(c.empresa.id)}
                    >
                      <TableCell className="pr-0">
                        {userCount > 0 && <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />}
                      </TableCell>
                      <TableCell>
                        <CompanyNameDisplay empresa={c.empresa} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{c.empresa.cnpj}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {userCount} {userCount === 1 ? "usuário" : "usuários"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(c.empresa.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir empresa</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir <strong>{c.empresa.nome_fantasia || c.empresa.razao_social}</strong>?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteCompanyMutation.mutate(c.empresa.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>

                    {/* Expanded user sub-rows */}
                    {isExpanded && allUsers.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isOwner = u.id === c.owner?.id;
                      return (
                        <TableRow key={u.id} className="bg-muted/20 border-border/10 hover:bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-2.5 pl-2">
                              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent/50 shrink-0">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{u.nome || "Sem nome"}</span>
                                  {isOwner && <Badge variant="outline" className="text-[9px] font-normal px-1.5 py-0">Dono</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-normal">{u.nivel}</Badge>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Switch checked={u.ativo} onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })} disabled={isSelf} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {!isSelf && (
                              <div className="flex items-center gap-0.5">
                                {u.nivel !== "Super Admin" && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" title="Promover a Super Admin">
                                        <Shield className="w-3.5 h-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Promover a Super Admin</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Conceder acesso global da plataforma para <strong>{u.email}</strong>? Essa pessoa poderá ver todos os dados de todas as empresas.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => promoteMutation.mutate(u.id)}>Promover</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Excluir usuário</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir <strong>{u.email}</strong>?</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteUserMutation.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                );
              })}
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
