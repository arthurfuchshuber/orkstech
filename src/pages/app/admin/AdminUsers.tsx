import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users, Building2, ChevronRight, Mail, Calendar, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  nome: string | null;
  ativo: boolean;
  nivel: string;
  empresa: string;
}

interface CompanyGroup {
  empresa: string;
  users: AdminUser[];
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_all_users" },
      });
      if (error) throw error;
      return data.users as AdminUser[];
    },
  });

  const groups = useMemo<CompanyGroup[]>(() => {
    if (!data?.length) return [];
    const map = new Map<string, AdminUser[]>();
    for (const u of data) {
      const key = u.empresa || "Sem empresa";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return Array.from(map.entries())
      .map(([empresa, users]) => ({ empresa, users }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa));
  }, [data]);

  const toggleExpand = (empresa: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(empresa)) next.delete(empresa);
      else next.add(empresa);
      return next;
    });
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "toggle_user_active", user_id, ativo },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {data?.length ?? 0} usuários em {groups.length} empresa{groups.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Carregando...</div>
          ) : !groups.length ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Nenhum usuário</div>
          ) : (
            <div className="space-y-1 px-3">
              {groups.map((group) => {
                const isOpen = expandedCompanies.has(group.empresa);
                return (
                  <div key={group.empresa} className="rounded-lg border border-border/40 overflow-hidden transition-all duration-200">
                    {/* Company row */}
                    <button
                      onClick={() => toggleExpand(group.empresa)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-muted/40",
                        isOpen && "bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                        isOpen ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                      )}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{group.empresa}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {group.users.length} usuário{group.users.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 text-muted-foreground/50 transition-transform duration-200",
                        isOpen && "rotate-90 text-primary/60"
                      )} />
                    </button>

                    {/* Users list */}
                    <div className={cn(
                      "transition-all duration-200 ease-in-out overflow-hidden",
                      isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <div className="border-t border-border/30 bg-muted/10">
                        {group.users.map((u, idx) => (
                          <div
                            key={u.id}
                            className={cn(
                              "flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20",
                              idx !== group.users.length - 1 && "border-b border-border/20"
                            )}
                          >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="w-3.5 h-3.5 text-primary/70" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 items-center">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {u.nome || "Sem nome"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Shield className="w-3 h-3 text-muted-foreground/50" />
                                  <Badge variant="outline" className="text-[10px] font-normal">{u.nivel}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-muted-foreground/50" />
                                  <span className="text-[11px] text-muted-foreground">
                                    {format(new Date(u.created_at), "dd/MM/yyyy")}
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <Switch
                                  checked={u.ativo}
                                  onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
