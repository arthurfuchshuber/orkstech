import { useState } from "react";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useSubscription } from "@/hooks/useSubscription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 1,
  enterprise: 999,
};

export function EmpresaSelector({ collapsed }: { collapsed: boolean }) {
  const { empresa, empresas, selectEmpresa } = useEmpresa();
  const { currentPlan } = useSubscription();
  const navigate = useNavigate();

  if (!empresa) return null;

  const displayName = empresa.nome_fantasia || empresa.razao_social;
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const limit = PLAN_LIMITS[currentPlan ?? "starter"] ?? 1;
  const canAddMore = empresas.length < limit;

  const handleNewEmpresa = () => {
    if (!canAddMore) {
      toast.error(`Seu plano permite até ${limit} empresa(s). Faça upgrade para adicionar mais.`);
      return;
    }
    navigate("/app/onboarding?new=1");
  };

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors mx-auto">
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          {empresas.map((e) => (
            <DropdownMenuItem
              key={e.id}
              onClick={() => selectEmpresa(e.id)}
              className="flex items-center justify-between"
            >
              <span className="text-sm truncate">{e.nome_fantasia || e.razao_social}</span>
              {e.id === empresa.id && <Check className="w-3.5 h-3.5 text-primary ml-2" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewEmpresa} className="text-primary">
            <Plus className="w-3.5 h-3.5 mr-2" />
            Nova Empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 border border-border/30 transition-all duration-200 text-left group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              {empresa.cnpj}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {empresas.map((e) => (
          <DropdownMenuItem
            key={e.id}
            onClick={() => selectEmpresa(e.id)}
            className="flex items-center justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm truncate">{e.nome_fantasia || e.razao_social}</p>
              <p className="text-[10px] text-muted-foreground">{e.cnpj}</p>
            </div>
            {e.id === empresa.id && <Check className="w-3.5 h-3.5 text-primary ml-2 flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleNewEmpresa} className="text-primary">
          <Plus className="w-3.5 h-3.5 mr-2" />
          Nova Empresa
          {!canAddMore && (
            <span className="ml-auto text-[10px] text-muted-foreground">Upgrade</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
