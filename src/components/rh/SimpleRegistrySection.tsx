import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Power, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DynamicIcon } from "@/components/DynamicIcon";

export interface ExtraField {
  key: string;
  label: string;
  type?: "text" | "number" | "color";
  placeholder?: string;
}

interface Props {
  table: string;
  title: string;
  subtitle: string;
  icon: string;
  queryKey: string;
  extraFields?: ExtraField[];
  defaultExtras?: Record<string, any>;
  /** Show secondary text on each row */
  secondaryFromRow?: (row: any) => string | undefined;
}

interface Row {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  [k: string]: any;
}

export function SimpleRegistrySection({
  table, title, subtitle, icon, queryKey,
  extraFields = [], defaultExtras = {}, secondaryFromRow,
}: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({ nome: "", ...defaultExtras });

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey, targetUserId, empresa?.id],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table).select("*").eq("user_id", targetUserId!)
        .order("ordem").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  useEffect(() => {
    if (editing) {
      const init: any = { nome: editing.nome };
      extraFields.forEach((f) => { init[f.key] = editing[f.key] ?? defaultExtras[f.key] ?? ""; });
      setForm(init);
    } else {
      setForm({ nome: "", ...defaultExtras });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { nome: form.nome.trim() };
      extraFields.forEach((f) => {
        let v: any = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        if (v === "") v = null;
        payload[f.key] = v;
      });
      if (editing) {
        const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.user_id = targetUserId;
        payload.empresa_id = empresa?.id ?? null;
        payload.ativo = true;
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(editing ? "Atualizado" : "Criado");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from(table).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast.success("Excluído"); },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir"),
  });

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <DynamicIcon name={icon} className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-md">
          <Plus className="w-3 h-3" /> Novo
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Nenhum registro.</div>
        ) : (
          <div>
            {items.map((item) => {
              const sec = secondaryFromRow?.(item);
              return (
                <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors ${!item.ativo ? "opacity-40" : ""}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.nome}</p>
                    {sec && <p className="text-[10px] text-muted-foreground truncate">{sec}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-4 ${item.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}`}>
                    {item.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5"><ChevronDown className="w-3 h-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(item); setOpen(true); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                        <Power className={`w-4 h-4 mr-2 ${item.ativo ? "text-emerald-400" : ""}`} /> {item.ativo ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? `Editar ${title}` : `Novo ${title}`}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} autoFocus />
            </div>
            {extraFields.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{f.label}</label>
                <Input
                  type={f.type === "number" ? "number" : f.type === "color" ? "color" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  maxLength={f.type === "text" ? 60 : undefined}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
