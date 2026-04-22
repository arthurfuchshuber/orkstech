import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { PERMISSION_CATALOG } from "@/hooks/usePermissions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Loader2, Eye, Pencil, Lock } from "lucide-react";
import { toast } from "sonner";

type PermissionState = Record<string, { can_view: boolean; can_edit: boolean }>;

interface Props {
  userId: string | null;
  userEmail: string | null;
  isOwner: boolean; // se for owner, somente leitura
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionsModal({ userId, userEmail, isOwner, open, onOpenChange }: Props) {
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [state, setState] = useState<PermissionState>({});

  const { data: existing, isLoading } = useQuery({
    queryKey: ["user-permissions-edit", userId, empresa?.id],
    enabled: open && !!userId && !!empresa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("action_key, can_view, can_edit")
        .eq("user_id", userId!)
        .eq("empresa_id", empresa!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!existing) return;
    const initial: PermissionState = {};
    [...PERMISSION_CATALOG.menu, ...PERMISSION_CATALOG.system].forEach((p) => {
      const found = existing.find((e) => e.action_key === p.key);
      initial[p.key] = {
        can_view: isOwner ? true : found?.can_view ?? false,
        can_edit: isOwner ? true : found?.can_edit ?? false,
      };
    });
    setState(initial);
  }, [existing, isOwner]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId || !empresa?.id) throw new Error("Dados ausentes");

      // Upsert para cada permissão
      const rows = Object.entries(state).map(([action_key, perms]) => ({
        user_id: userId,
        empresa_id: empresa.id,
        action_key,
        can_view: perms.can_view,
        can_edit: perms.can_edit,
      }));

      const { error } = await supabase
        .from("user_permissions")
        .upsert(rows, { onConflict: "user_id,empresa_id,action_key" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas");
      qc.invalidateQueries({ queryKey: ["user-permissions"] });
      qc.invalidateQueries({ queryKey: ["user-permissions-edit"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: string, field: "can_view" | "can_edit", value: boolean) => {
    setState((prev) => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } };
      // Se desmarcar visualizar, desmarca editar também
      if (field === "can_view" && !value) next[key].can_edit = false;
      // Se marcar editar, marca visualizar também
      if (field === "can_edit" && value) next[key].can_view = true;
      return next;
    });
  };

  const renderSection = (title: string, items: readonly { key: string; label: string; alwaysOn?: boolean }[]) => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{title}</p>
      <div className="rounded-lg border border-border/50 divide-y divide-border/30 overflow-hidden">
        {items.map((item) => {
          const perms = state[item.key] ?? { can_view: false, can_edit: false };
          const locked = isOwner || item.alwaysOn;
          return (
            <div key={item.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
              <span className="flex-1 text-xs text-foreground">{item.label}</span>
              {item.alwaysOn && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">sempre</Badge>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                <Checkbox
                  checked={perms.can_view}
                  disabled={locked}
                  onCheckedChange={(v) => toggle(item.key, "can_view", !!v)}
                />
                <Eye className="w-3 h-3" /> Ver
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                <Checkbox
                  checked={perms.can_edit}
                  disabled={locked}
                  onCheckedChange={(v) => toggle(item.key, "can_edit", !!v)}
                />
                <Pencil className="w-3 h-3" /> Editar
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Permissões personalizadas
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isOwner ? (
              <span className="flex items-center gap-1.5 text-warning">
                <Lock className="w-3 h-3" /> {userEmail} é o dono da empresa e tem acesso total. Permissões não podem ser alteradas.
              </span>
            ) : (
              <>Defina o que <strong>{userEmail}</strong> pode visualizar e editar nesta empresa.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <ScrollArea className="flex-1 pr-2 -mr-2">
            <div className="space-y-4 py-1">
              {renderSection("Páginas do menu", PERMISSION_CATALOG.menu)}
              {renderSection("Áreas sistêmicas", PERMISSION_CATALOG.system)}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {isOwner ? "Fechar" : "Cancelar"}
          </Button>
          {!isOwner && (
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Salvar permissões
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
