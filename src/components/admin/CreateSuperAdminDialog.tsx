import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreateSuperAdminDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "" });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.email.trim() || !form.password) {
        throw new Error("Preencha todos os campos");
      }
      if (form.password.length < 8) {
        throw new Error("Senha deve ter pelo menos 8 caracteres");
      }
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: {
          action: "create_super_admin",
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Super Admin criado com sucesso");
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      setForm({ nome: "", email: "", password: "" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar Super Admin"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Novo Admin do SaaS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Admin do SaaS</DialogTitle>
          <DialogDescription className="text-xs">
            Cria um Super Admin com acesso total à plataforma. Não passa pelo onboarding de empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              maxLength={60}
              className="h-9 text-sm"
              placeholder="Nome do administrador"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={60}
              className="h-9 text-sm"
              placeholder="admin@exemplo.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              maxLength={60}
              className="h-9 text-sm"
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Compartilhe a senha de forma segura com a pessoa.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Criando...</>
            ) : "Criar Super Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
