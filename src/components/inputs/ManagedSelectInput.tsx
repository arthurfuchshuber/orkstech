import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown, Plus, Pencil, Trash2, Check, X,
  GripVertical, ArrowUp, ArrowDown
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export interface ManagedOption {
  value: string;
  label: string;
}

interface ManagedSelectInputProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ManagedOption[];
  label?: string;
  error?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  // CRUD callbacks (inline mode)
  onAdd?: (label: string) => Promise<string | null>;
  onEdit?: (id: string, label: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onReorder?: (orderedIds: string[]) => Promise<boolean>;
  /** Modal-based add/edit — when provided, these replace inline forms */
  onAddModal?: () => void;
  onEditModal?: (id: string) => void;
  /** Label for the "add new" input/button */
  addLabel?: string;
  disabled?: boolean;
}

export function ManagedSelectInput({
  value,
  onValueChange,
  options,
  label,
  error,
  placeholder = "Selecione...",
  icon,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  onAddModal,
  onEditModal,
  addLabel = "Novo item",
  disabled = false,
}: ManagedSelectInputProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "add" | "edit">("select");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [localOptions, setLocalOptions] = useState<ManagedOption[]>(options);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  useEffect(() => {
    if ((mode === "add" || mode === "edit") && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  const selectedLabel = localOptions.find((o) => o.value === value)?.label;

  const filtered = searchTerm
    ? localOptions.filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : localOptions;

  const startAdd = () => {
    if (onAddModal) {
      setOpen(false);
      onAddModal();
      return;
    }
    setInputValue("");
    setMode("add");
  };

  const startEdit = (opt: ManagedOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditModal) {
      setOpen(false);
      onEditModal(opt.value);
      return;
    }
    setEditingId(opt.value);
    setInputValue(opt.label);
    setMode("edit");
  };

  const cancelInput = () => {
    setMode("select");
    setEditingId(null);
    setInputValue("");
  };

  const confirmAdd = async () => {
    if (!inputValue.trim() || !onAdd) return;
    const newId = await onAdd(inputValue.trim());
    if (newId) {
      toast.success("Item adicionado");
      onValueChange(newId);
    }
    cancelInput();
  };

  const confirmEdit = async () => {
    if (!inputValue.trim() || !editingId || !onEdit) return;
    const ok = await onEdit(editingId, inputValue.trim());
    if (ok) toast.success("Item atualizado");
    cancelInput();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    const ok = await onDelete(id);
    if (ok) {
      toast.success("Item excluído");
      if (value === id) onValueChange("");
    }
  };

  const moveItem = async (id: string, direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onReorder) return;
    const idx = localOptions.findIndex((o) => o.value === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= localOptions.length) return;

    const reordered = [...localOptions];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setLocalOptions(reordered);
    await onReorder(reordered.map((o) => o.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      mode === "add" ? confirmAdd() : confirmEdit();
    } else if (e.key === "Escape") {
      cancelInput();
    }
  };

  const hasManagement = onAdd || onEdit || onDelete || onReorder || onAddModal || onEditModal;
  const hasAdd = onAdd || onAddModal;
  const hasEdit = onEdit || onEditModal;

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) cancelInput(); setSearchTerm(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all duration-200 cursor-pointer",
              "hover:border-muted-foreground/30",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              !value && "text-muted-foreground/50",
              error && "border-destructive focus:ring-destructive/30 focus:border-destructive"
            )}
          >
            {icon && <span className="mr-2 text-muted-foreground">{icon}</span>}
            <span className="flex-1 text-left truncate">{selectedLabel || placeholder}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {/* Search */}
          {mode === "select" && (
            <div className="p-2 border-b border-border/50">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Add / Edit inline form */}
          {mode !== "select" && (
            <div className="p-2 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {mode === "add" ? addLabel : "Editar item"}
              </p>
              <div className="flex gap-1.5">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nome do item..."
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={mode === "add" ? confirmAdd : confirmEdit}
                  disabled={!inputValue.trim()}
                >
                  <Check className="w-3.5 h-3.5 text-primary" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelInput}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Options list */}
          <ScrollArea className="max-h-[240px]">
            <div className="p-1">
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma opção encontrada
                </div>
              ) : (
                filtered.map((opt, idx) => (
                  <div
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer group transition-colors",
                      "hover:bg-accent/50",
                      value === opt.value && "bg-primary/[0.08] text-primary font-medium"
                    )}
                    onClick={() => {
                      if (mode !== "select") return;
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {/* Reorder grip */}
                    {onReorder && mode === "select" && (
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity -ml-1">
                        <button
                          type="button"
                          className="p-0 h-3 hover:text-primary disabled:opacity-30"
                          onClick={(e) => moveItem(opt.value, "up", e)}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          className="p-0 h-3 hover:text-primary disabled:opacity-30"
                          onClick={(e) => moveItem(opt.value, "down", e)}
                          disabled={idx === filtered.length - 1}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <span className="flex-1 truncate">{opt.label}</span>

                    {value === opt.value && (
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    )}

                    {/* Action buttons */}
                    {hasManagement && mode === "select" && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasEdit && (
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-muted"
                            onClick={(e) => startEdit(opt, e)}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-destructive/10"
                            onClick={(e) => handleDelete(opt.value, e)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Add button */}
          {hasAdd && mode === "select" && (
            <div className="border-t border-border/50 p-1">
              <button
                type="button"
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-primary hover:bg-primary/[0.08] transition-colors"
                onClick={startAdd}
              >
                <Plus className="w-3.5 h-3.5" />
                {addLabel}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
