import { useMemo, useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoriaTreeNode {
  id: string;
  nome: string;
  tipo: string;
  categoria_pai_id: string | null;
  ordem?: number;
  ativo?: boolean;
}

interface Props {
  /** Lista completa (com pais e folhas). */
  categorias: CategoriaTreeNode[];
  /** Categoria atualmente selecionada. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** 'in' = só receitas/resultado financeiro/ajuste; 'out' = saídas; 'both' = sem filtro. */
  direction: "in" | "out" | "both";
  /** Texto exibido no trigger quando vazio. */
  placeholder?: string;
  /** Mostra o botão "Limpar". */
  clearable?: boolean;
  /** Tamanho do trigger. */
  size?: "sm" | "md";
  className?: string;
  triggerClassName?: string;
  /** Slot opcional para botões de ação no rodapé (ex.: "Nova subcategoria"). */
  footerActions?: React.ReactNode;
  disabled?: boolean;
}

const ALLOWED_INCOME = new Set([
  "receita",
  "receita_financeira",
  "ajuste",
]);
const ALLOWED_EXPENSE = new Set([
  "despesa",
  "despesa_comercial",
  "custo",
  "deducao",
  "imposto",
  "despesa_financeira",
  "distribuicao_lucros",
  "ajuste",
]);

/**
 * Componente unificado para selecionar uma SUBCATEGORIA do plano de contas (DRE).
 *
 * - Árvore expansível com chevron para abrir/fechar grupos.
 * - Apenas folhas (último nível) são selecionáveis. Nós com filhos servem só para navegação.
 * - Filtra por tipo (entrada/saída/ambos) com base no `direction`.
 * - Busca digitável: ao digitar, exibe lista plana de folhas que casam (nome + caminho ancestral).
 * - Mostra o caminho hierárquico em texto secundário abaixo do nome.
 *
 * Padrão único usado em: Extrato Bancário, Modal "Sem categorização" e drill-down do DRE.
 */
export function CategoriaTreeSelect({
  categorias,
  value,
  onChange,
  direction,
  placeholder = "Selecionar subcategoria",
  clearable = true,
  size = "sm",
  className,
  triggerClassName,
  footerActions,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Mapas auxiliares
  const byId = useMemo(() => {
    const m = new Map<string, CategoriaTreeNode>();
    categorias.forEach((c) => m.set(c.id, c));
    return m;
  }, [categorias]);

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, CategoriaTreeNode[]>();
    categorias.forEach((c) => {
      const arr = m.get(c.categoria_pai_id) ?? [];
      arr.push(c);
      m.set(c.categoria_pai_id, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
    return m;
  }, [categorias]);

  const isLeaf = (id: string) => !(childrenOf.get(id)?.length ?? 0);

  /** Verifica se a categoria (ou algum ancestral) tem o tipo permitido pela direção. */
  const allowedTipoSet =
    direction === "in" ? ALLOWED_INCOME : direction === "out" ? ALLOWED_EXPENSE : null;

  const matchesDirection = (node: CategoriaTreeNode): boolean => {
    if (!allowedTipoSet) return true;
    return allowedTipoSet.has(node.tipo);
  };

  /** Caminho ancestral (ex.: "Custos Diretos > Gestão de Imóveis"). */
  const buildAncestorPath = (id: string): string => {
    const parts: string[] = [];
    let cur = byId.get(id);
    while (cur?.categoria_pai_id) {
      const parent = byId.get(cur.categoria_pai_id);
      if (!parent) break;
      parts.unshift(parent.nome);
      cur = parent;
    }
    return parts.join(" > ");
  };

  /** Folhas filtradas por direção (somente último nível). */
  const allowedLeaves = useMemo(
    () => categorias.filter((c) => isLeaf(c.id) && matchesDirection(c) && c.ativo !== false),
    [categorias, allowedTipoSet],
  );

  /** Conjunto de ids visíveis (folhas permitidas + todos seus ancestrais). */
  const visibleIds = useMemo(() => {
    const set = new Set<string>();
    allowedLeaves.forEach((leaf) => {
      set.add(leaf.id);
      let cur = byId.get(leaf.categoria_pai_id ?? "");
      while (cur) {
        set.add(cur.id);
        cur = cur.categoria_pai_id ? byId.get(cur.categoria_pai_id) : undefined;
      }
    });
    return set;
  }, [allowedLeaves, byId]);

  /** Resultados de busca (lista plana de folhas). */
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allowedLeaves
      .map((leaf) => ({ leaf, path: buildAncestorPath(leaf.id) }))
      .filter(({ leaf, path }) => {
        const hay = `${leaf.nome} ${path}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [query, allowedLeaves]);

  const selected = value ? byId.get(value) : null;
  const selectedPath = value ? buildAncestorPath(value) : "";

  // Auto-foca a busca ao abrir + auto-expande caminho da seleção atual
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      if (value) {
        const path = new Set<string>();
        let cur = byId.get(value);
        while (cur?.categoria_pai_id) {
          path.add(cur.categoria_pai_id);
          cur = byId.get(cur.categoria_pai_id);
        }
        setExpanded((prev) => new Set([...prev, ...path]));
      }
    } else {
      setQuery("");
    }
  }, [open]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  /** Render recursivo da árvore. */
  const renderNode = (node: CategoriaTreeNode, depth: number): React.ReactNode => {
    if (!visibleIds.has(node.id)) return null;
    const kids = (childrenOf.get(node.id) ?? []).filter((c) => visibleIds.has(c.id));
    const leaf = kids.length === 0;
    const isOpen = expanded.has(node.id);
    const isSelected = leaf && node.id === value;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => (leaf ? handleSelect(node.id) : toggleExpand(node.id))}
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1.5 text-left rounded-sm transition-colors text-sm",
            leaf
              ? "hover:bg-accent cursor-pointer"
              : "hover:bg-muted/50 cursor-pointer text-muted-foreground",
            isSelected && "bg-primary/10 text-primary font-medium",
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {leaf ? (
            <span className="w-3.5 h-3.5 flex-shrink-0 inline-flex items-center justify-center">
              {isSelected ? <Check className="w-3 h-3" /> : <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />}
            </span>
          ) : isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
          )}
          <span className="truncate">{node.nome}</span>
        </button>
        {!leaf && isOpen && (
          <div>{kids.map((k) => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  };

  const roots = (childrenOf.get(null) ?? []).filter((c) => visibleIds.has(c.id));

  const triggerHeight = size === "sm" ? "h-7" : "h-9";

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group/cat flex items-center gap-1 w-full text-left transition-colors min-w-0",
            triggerHeight,
            "text-sm hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            triggerClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground/60")}>
            {selected?.nome || placeholder}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cat:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[340px] p-0 overflow-hidden", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoria..."
              className="h-8 pl-7 pr-7 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {selected && (
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1 truncate">
              Atual: <span className="text-foreground/80">{selectedPath ? `${selectedPath} > ` : ""}{selected.nome}</span>
            </p>
          )}
        </div>

        <div className="max-h-[280px] overflow-y-auto custom-scrollbar py-1">
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma categoria encontrada
              </p>
            ) : (
              <div>
                {searchResults.map(({ leaf, path }) => {
                  const isSelected = leaf.id === value;
                  return (
                    <button
                      key={leaf.id}
                      type="button"
                      onClick={() => handleSelect(leaf.id)}
                      className={cn(
                        "w-full flex flex-col items-start gap-0.5 px-2.5 py-1.5 text-left hover:bg-accent transition-colors",
                        isSelected && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="text-sm truncate w-full">{leaf.nome}</span>
                      {path && (
                        <span className="text-[10px] text-muted-foreground/80 truncate w-full">
                          {path}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : roots.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma categoria disponível para este tipo
            </p>
          ) : (
            roots.map((r) => renderNode(r, 0))
          )}
        </div>

        {(clearable || footerActions) && (
          <div className="border-t border-border/50 p-1.5 flex items-center gap-1">
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1.5 rounded-sm transition-colors text-left"
              >
                Limpar categoria
              </button>
            )}
            {footerActions}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
