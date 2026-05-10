import * as React from "react";
import { useState } from "react";
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface InlineCellOption {
  value: string;
  label: string;
  hint?: string;
}

interface InlineManagedCellProps {
  value: string | null | undefined;
  options: InlineCellOption[];
  onChange: (value: string | null) => void;
  onAddModal?: () => void;
  onEditModal?: (id: string) => void;
  onDelete?: (id: string) => Promise<boolean> | boolean;
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
  disabled?: boolean;
}

/**
 * Célula de tabela com edição inline.
 * Mostra valor como texto; ao clicar abre popover com:
 * - busca
 * - lista com Editar (lápis → modal pai) e Excluir por item
 * - "Limpar" e "+ Adicionar" (modal pai)
 */
export function InlineManagedCell({
  value,
  options,
  onChange,
  onAddModal,
  onEditModal,
  onDelete,
  placeholder = "Selecionar",
  addLabel = "Adicionar novo",
  emptyHint,
  disabled,
}: InlineManagedCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    const ok = await onDelete(id);
    if (ok) {
      toast.success("Item excluído");
      if (value === id) onChange(null);
    }
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group w-full text-left",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="truncate">
            {selected?.label || <span className="text-muted-foreground/50">{placeholder}</span>}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="p-2 border-b border-border/50">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1">
          {filtered.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              {emptyHint || "Nenhuma opção encontrada"}
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer group/row transition-colors",
                  "hover:bg-accent/50",
                  value === opt.value && "bg-primary/[0.08] text-primary font-medium"
                )}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.hint && <span className="text-[10px] text-muted-foreground/60">{opt.hint}</span>}
                <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  {onEditModal && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted"
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onEditModal(opt.value); }}
                      title="Editar cadastro"
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-destructive/10"
                      onClick={(e) => handleDelete(opt.value, e)}
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border/50 p-1 flex flex-col">
          {value && (
            <button
              type="button"
              className="text-left rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Limpar seleção
            </button>
          )}
          {onAddModal && (
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-primary/[0.08] transition-colors"
              onClick={() => { setOpen(false); onAddModal(); }}
            >
              <Plus className="w-3.5 h-3.5" />
              {addLabel}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
