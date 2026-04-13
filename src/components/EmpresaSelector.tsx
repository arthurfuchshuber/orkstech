import { useState, useMemo } from "react";
import { Building2, ChevronDown, Plus, Check, Search, Shield } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useSubscription } from "@/hooks/useSubscription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { UpgradeDialog } from "@/components/UpgradeDialog";

const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 1,
  enterprise: 999,
};

export function EmpresaSelector({ collapsed }: { collapsed: boolean }) {
  const { empresa, empresas, selectEmpresa, isSuperAdminMode } = useEmpresa();
  const { currentPlan } = useSubscription();
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [search, setSearch] = useState("");

  if (!empresa && !isSuperAdminMode) return null;

  const displayName = empresa
    ? empresa.nome_fantasia || empresa.razao_social
    : "Nenhuma empresa";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const limit = PLAN_LIMITS[currentPlan ?? "starter"] ?? 1;
  const canAddMore = isSuperAdminMode || empresas.length < limit;

  const filteredEmpresas = useMemo(() => {
    if (!search) return empresas;
    const q = search.toLowerCase();
    return empresas.filter(
      (e) =>
        e.razao_social?.toLowerCase().includes(q) ||
        e.nome_fantasia?.toLowerCase().includes(q) ||
        e.cnpj?.includes(q)
    );
  }, [empresas, search]);

  const handleNewEmpresa = () => {
    if (!canAddMore) {
      setShowUpgrade(true);
      return;
    }
    navigate("/app/onboarding?new=1");
  };

  if (collapsed) {
    return (
      <>
        <DropdownMenu onOpenChange={(open) => { if (!open) setSearch(""); }}>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors mx-auto">
              {isSuperAdminMode ? <Shield className="w-4 h-4" /> : initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-72">
            {isSuperAdminMode && (
              <>
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">Super Admin — Todas as empresas</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-7 text-xs pl-7"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <div className="max-h-64 overflow-y-auto">
              {filteredEmpresas.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  onClick={() => selectEmpresa(e.id)}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm truncate">{e.nome_fantasia || e.razao_social}</span>
                  {e.id === empresa?.id && <Check className="w-3.5 h-3.5 text-primary ml-2" />}
                </DropdownMenuItem>
              ))}
              {filteredEmpresas.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma empresa encontrada</div>
              )}
            </div>
            {!isSuperAdminMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNewEmpresa} className="text-primary">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Nova Empresa
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          description={`Seu plano (${currentPlan ?? "starter"}) permite até ${limit} empresa(s). Faça upgrade para adicionar mais.`}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => { if (!open) setSearch(""); }}>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 border border-border/30 transition-all duration-200 text-left group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {isSuperAdminMode ? <Shield className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {isSuperAdminMode
                  ? `${empresas.length} empresas na plataforma`
                  : empresa?.cnpj}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px]">
          {isSuperAdminMode && (
            <>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary">Super Admin — Todas as empresas</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CNPJ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 text-xs pl-7"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filteredEmpresas.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onClick={() => selectEmpresa(e.id)}
                className="flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{e.nome_fantasia || e.razao_social}</p>
                  <p className="text-[10px] text-muted-foreground">{e.cnpj}</p>
                </div>
                {e.id === empresa?.id && <Check className="w-3.5 h-3.5 text-primary ml-2 flex-shrink-0" />}
              </DropdownMenuItem>
            ))}
            {filteredEmpresas.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma empresa encontrada</div>
            )}
          </div>
          {!isSuperAdminMode && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleNewEmpresa} className="text-primary">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Nova Empresa
                {!canAddMore && (
                  <span className="ml-auto text-[10px] text-muted-foreground">Upgrade</span>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        description={`Seu plano (${currentPlan ?? "starter"}) permite até ${limit} empresa(s). Faça upgrade para adicionar mais.`}
      />
    </>
  );
}
