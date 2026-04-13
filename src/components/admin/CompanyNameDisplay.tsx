import { Building2 } from "lucide-react";
import type { EmpresaInfo } from "./AdminUserTypes";

interface Props {
  empresa: EmpresaInfo;
  showIcon?: boolean;
}

export function CompanyNameDisplay({ empresa, showIcon = true }: Props) {
  const displayName = empresa.nome_fantasia || empresa.razao_social;
  const subtitle = empresa.nome_fantasia ? empresa.razao_social : null;

  return (
    <div className="flex items-center gap-2.5">
      {showIcon && (
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 shrink-0">
          <Building2 className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className="min-w-0">
        <span className="text-sm font-medium text-foreground block truncate">
          {displayName}
        </span>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
