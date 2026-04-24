import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { PERMISSION_CATALOG } from "@/hooks/usePermissions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Loader2, Lock, Search, EyeOff, Eye, Pencil,
  LayoutGrid, Settings2, CheckCheck, XCircle,
} from "lucide-react";
import { toast } from "sonner";

type AccessLevel = "none" | "view" | "edit";
type PermissionState = Record<string, AccessLevel>;

interface Props {
  userId: string | null;
  userEmail: string | null;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override empresa do contexto (usado pelo painel admin que opera cross-tenant) */
  empresaIdOverride?: string | null;
}

const LEVELS: { value: AccessLevel; label: string; icon: typeof Eye; tone: string }[] = [
  { value: "none", label: "Sem acesso", icon: EyeOff, tone: "text-muted-foreground" },
  { value: "view", label: "Visualizar", icon: Eye, tone: "text-primary" },
  { value: "edit", label: "Editar", icon: Pencil, tone: "text-success" },
];

export function PermissionsModal({ userId, userEmail, isOwner, open, onOpenChange, empresaIdOverride }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresaIdOverride ?? empresa?.id ?? null;
  const qc = useQueryClient();
  const [state, setState] = useState<PermissionState>({});
  const [search, setSearch] = useState("");

  const { data: existing, isLoading } = useQuery({
    queryKey: ["user-permissions-edit", userId, empresaId],
    enabled: open && !!userId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("action_key, can_view, can_edit")
        .eq("user_id", userId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!existing) return;
    const initial: PermissionState = {};
    [...PERMISSION_CATALOG.menu, ...PERMISSION_CATALOG.system].forEach((p) => {
      const found = existing.find((e) => e.action_key === p.key);
      if (isOwner) {
        initial[p.key] = "edit";
      } else if (found?.can_edit) {
        initial[p.key] = "edit";
      } else if (found?.can_view) {
        initial[p.key] = "view";
      } else {
        initial[p.key] = "none";
      }
    });
    setState(initial);
  }, [existing, isOwner]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId || !empresaId) throw new Error("Dados ausentes");
      const rows = Object.entries(state).map(([action_key, level]) => ({
        user_id: userId,
        empresa_id: empresaId,
        action_key,
        can_view: level !== "none",
        can_edit: level === "edit",
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
      qc.invalidateQueries({ queryKey: ["admin-perm-summary"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setLevel = (key: string, level: AccessLevel) => {
    setState((prev) => ({ ...prev, [key]: level }));
  };

  const bulkSet = (items: readonly { key: string; alwaysOn?: boolean }[], level: AccessLevel) => {
    setState((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (item.alwaysOn && level === "none") return; // não desativa sempre-on
        next[item.key] = item.alwaysOn ? (level === "none" ? "view" : level) : level;
      });
      return next;
    });
  };

  const filterItems = <T extends { label: string }>(items: readonly T[]) =>
    search
      ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
      : items;

  const stats = useMemo(() => {
    const values = Object.values(state);
    return {
      edit: values.filter((v) => v === "edit").length,
      view: values.filter((v) => v === "view").length,
      none: values.filter((v) => v === "none").length,
      total: values.length,
    };
  }, [state]);

  const renderRow = (item: { key: string; label: string; alwaysOn?: boolean }) => {
    const current = state[item.key] ?? "none";
    const locked = isOwner || item.alwaysOn;

    return (
      <div
        key={item.key}
        className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate">{item.label}</span>
            {item.alwaysOn && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">
                obrigatório
              </Badge>
            )}
          </div>
        </div>

        <div
          className={cn(
            "inline-flex items-center rounded-md border border-border/50 bg-muted/30 p-0.5 gap-0.5",
            locked && "opacity-60"
          )}
        >
          {LEVELS.map((lvl) => {
            const Icon = lvl.icon;
            const active = current === lvl.value;
            const disabled = locked || (item.alwaysOn && lvl.value === "none");
            return (
              <button
                key={lvl.value}
                type="button"
                disabled={disabled}
                onClick={() => setLevel(item.key, lvl.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                  "disabled:cursor-not-allowed",
                  active
                    ? lvl.value === "edit"
                      ? "bg-success/15 text-success shadow-sm"
                      : lvl.value === "view"
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "bg-foreground/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="w-3 h-3" />
                {lvl.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    Icon: typeof LayoutGrid,
    items: readonly { key: string; label: string; alwaysOn?: boolean }[]
  ) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <span className="text-[10px] text-muted-foreground/60">({filtered.length})</span>
          </div>
          {!isOwner && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => bulkSet(items, "none")}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" /> Limpar
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                type="button"
                onClick={() => bulkSet(items, "view")}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Tudo ver
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                type="button"
                onClick={() => bulkSet(items, "edit")}
                className="text-[10px] text-muted-foreground hover:text-success transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Tudo editar
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border/50 divide-y divide-border/30 overflow-hidden bg-card/30">
          {filtered.map(renderRow)}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>Permissões personalizadas</span>
              <span className="text-xs font-normal text-muted-foreground">{userEmail}</span>
            </div>
          </DialogTitle>

          {isOwner ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Este usuário é o dono da empresa e tem acesso total. As permissões não podem ser alteradas.</span>
            </div>
          ) : (
            <DialogDescription className="text-xs sr-only">
              Defina o nível de acesso para cada página e área do sistema.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Stats + busca */}
        {!isLoading && (
          <div className="px-6 py-3 border-b border-border/30 bg-muted/20 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1 font-normal">
                <Pencil className="w-3 h-3 text-success" />
                <span className="text-success font-medium">{stats.edit}</span>
                <span className="text-muted-foreground">editar</span>
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <Eye className="w-3 h-3 text-primary" />
                <span className="text-primary font-medium">{stats.view}</span>
                <span className="text-muted-foreground">ver</span>
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <EyeOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground font-medium">{stats.none}</span>
                <span className="text-muted-foreground">bloqueado</span>
              </Badge>
            </div>
            <div className="relative ml-auto flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar permissão..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Carregando permissões...
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-5">
              {renderSection("Páginas do menu", LayoutGrid, PERMISSION_CATALOG.menu)}
              {renderSection("Áreas sistêmicas", Settings2, PERMISSION_CATALOG.system)}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/10">
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
