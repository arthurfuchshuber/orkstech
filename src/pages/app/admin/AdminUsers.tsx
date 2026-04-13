import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users, Building2, ChevronDown, Mail, Calendar, Shield, User } from "lucide-react";
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

interface UserGroup {
  user: AdminUser;
  empresas: string[];
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

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

  const userGroups = useMemo<UserGroup[]>(() => {
    if (!data?.length) return [];
    const map = new Map<string, UserGroup>();
    for (const u of data) {
      if (!map.has(u.id)) {
        map.set(u.id, { user: u, empresas: [] });
      }
      const group = map.get(u.id)!;
      if (u.empresa) group.empresas.push(u.empresa);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.user.nome || "").localeCompare(b.user.nome || "")
    );
  }, [data]);

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
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

  const totalEmpresas = useMemo(() => {
    const set = new Set<string>();
    userGroups.forEach((g) => g.empresas.forEach((e) => set.add(e)));
    return set.size;
  }, [userGroups]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {userGroups.length} usuário{userGroups.length !== 1 ? "s" : ""} em {totalEmpresas} empresa{totalEmpresas !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Carregando...</div>
          ) : !userGroups.length ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Nenhum usuário</div>
          ) : (
            <div className="space-y-1 px-3">
              {userGroups.map((group) => {
                const { user: u, empresas } = group;
                const isOpen = expandedUsers.has(u.id);
                const hasEmpresas = empresas.length > 0;

                return (
                  <div key={u.id} className="rounded-lg border border-border/40 overflow-hidden transition-all duration-200">
                    {/* User row */}
                    <div className={cn(
                      "flex items-center gap-4 px-4 py-3 transition-colors",
                      isOpen && "bg-muted/20"
                    )}>
                      {/* Expand button or spacer */}
                      {hasEmpresas ? (
                        <button
                          onClick={() => toggleExpand(u.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <ChevronDown className={cn(
                            "w-4 h-4 text-primary/70 transition-transform duration-200",
                            isOpen && "rotate-180"
                          )} />
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/40">
                          <User className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                      )}

                      {/* User info */}
                      <div className="flex-1 min-w-0 flex items-center gap-6">
                        <p className="text-sm font-medium text-foreground truncate min-w-[160px]">
                          {u.nome || "Sem nome"}
                        </p>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                        </div>
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

                      {/* Toggle */}
                      <Switch
                        checked={u.ativo}
                        onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })}
                      />
                    </div>

                    {/* Empresas sub-list */}
                    <div className={cn(
                      "transition-all duration-200 ease-in-out overflow-hidden",
                      isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <div className="border-t border-border/30 bg-muted/10">
                        {empresas.map((empresa, idx) => (
                          <div
                            key={empresa}
                            className={cn(
                              "flex items-center gap-3 pl-16 pr-5 py-2.5 transition-colors hover:bg-muted/20",
                              idx !== empresas.length - 1 && "border-b border-border/20"
                            )}
                          >
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-3 h-3 text-primary/70" />
                            </div>
                            <span className="text-xs text-muted-foreground">{empresa}</span>
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
