import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, UserCircle2 } from "lucide-react";
import { ColaboradorModal } from "@/components/rh/ColaboradorModal";
import { useDepartamentos, useCargos, useTiposVinculo } from "@/hooks/useRH";

export default function RHColaboradores() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: deps = [] } = useDepartamentos();
  const { data: cargos = [] } = useCargos();
  const { data: vinculos = [] } = useTiposVinculo();

  const depMap = new Map(deps.map((d: any) => [d.id, d.nome]));
  const cargoMap = new Map(cargos.map((c: any) => [c.id, c.nome]));
  const vincMap = new Map(vinculos.map((v: any) => [v.id, v.nome]));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["rh_colaboradores", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores").select("*")
        .eq("user_id", targetUserId!).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i: any) => !q || i.nome?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q));
  }, [items, search]);

  const totalAtivos = items.filter((i: any) => i.ativo && i.status !== "demitido").length;
  const folhaMensal = items.reduce((s: number, i: any) => i.ativo ? s + Number(i.salario || 0) : s, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Cadastro central da equipe — vínculos, remuneração, equipamentos e acessos.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Colaborador
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
          <p className="text-2xl font-bold mt-1">{totalAtivos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Folha base mensal</p>
          <p className="text-2xl font-bold mt-1">R$ {folhaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Departamentos</p>
          <p className="text-2xl font-bold mt-1">{deps.filter((d: any) => d.ativo).length}</p>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Nenhum colaborador cadastrado ainda." : "Nenhum resultado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 w-[28%]">Colaborador</th>
                  <th className="py-2 pr-3 w-[18%]">Cargo</th>
                  <th className="py-2 pr-3 w-[18%]">Departamento</th>
                  <th className="py-2 pr-3 w-[12%]">Vínculo</th>
                  <th className="py-2 pr-3 w-[14%] text-right">Salário</th>
                  <th className="py-2 w-[10%] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20 cursor-pointer">
                    <td className="py-2.5 pr-3">
                      <Link to={`/app/rh/colaboradores/${c.id}`} className="flex items-center gap-2 hover:text-primary">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCircle2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.nome}</p>
                          {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{cargoMap.get(c.cargo_id) ?? c.cargo ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{depMap.get(c.departamento_id) ?? c.departamento ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{vincMap.get(c.tipo_vinculo_id) ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right">R$ {Number(c.salario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right">
                      <Badge variant="outline" className={c.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>
                        {c.ativo ? (c.status ?? "Ativo") : "Inativo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ColaboradorModal open={open} onOpenChange={setOpen} editingId={editingId} />
    </div>
  );
}
