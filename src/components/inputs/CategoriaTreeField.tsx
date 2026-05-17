import { FolderTree } from "lucide-react";
import { CategoriaTreeSelect, type CategoriaTreeNode } from "./CategoriaTreeSelect";

interface Props {
  label?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  categorias: CategoriaTreeNode[];
  direction: "in" | "out" | "both";
  placeholder?: string;
  error?: string;
  footerActions?: React.ReactNode;
  disabled?: boolean;
}

/** Wrapper "form input" (label + caixa) ao redor do CategoriaTreeSelect — pra uso em modais/formulários. */
export function CategoriaTreeField({
  label = "Subcategoria (Plano de Contas)",
  value,
  onChange,
  categorias,
  direction,
  placeholder = "Selecione a subcategoria...",
  error,
  footerActions,
  disabled,
}: Props) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <div
        className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-background px-3 ${
          error ? "border-destructive" : "border-input"
        }`}
      >
        <FolderTree className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <CategoriaTreeSelect
            categorias={categorias}
            value={value}
            onChange={onChange}
            direction={direction}
            placeholder={placeholder}
            footerActions={footerActions}
            disabled={disabled}
            size="md"
            triggerClassName="!h-auto"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
