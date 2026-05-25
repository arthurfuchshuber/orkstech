import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabela responsiva global.
 * - Desktop (md+): tabela tradicional.
 * - Mobile (<md): cada <tr> vira um card. Por padrão mostra apenas as 2
 *   primeiras "linhas de dados" e um chevron na base para expandir/recolher
 *   o restante. Click em qualquer área não-interativa do card alterna o estado.
 *
 * Atributos opcionais:
 *  - <TableHead data-mobile-hide>     → coluna escondida no mobile
 *  - <TableCell data-mobile-hide>     → célula escondida no mobile
 *  - <TableCell data-mobile-always>   → célula sempre visível (não conta nas 2 primeiras nem colapsa)
 *  - <TableCell data-no-toggle>       → clicks aqui não alternam o card
 */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTableElement | null>(null);
    const setRefs = (node: HTMLTableElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTableElement | null>).current = node;
    };

    // Sync de rótulos (data-label) e marcação de colapsáveis (data-mobile-collapsible)
    React.useEffect(() => {
      const table = innerRef.current;
      if (!table) return;

      const ROLE_MAP: Array<[RegExp, string]> = [
        [/^(descri[çc][ãa]o|hist[óo]rico|nome|raz[ãa]o social|t[íi]tulo|categoria)$/i, "title"],
        [/^(valor|total|saldo|montante|valor total|valor pago)$/i, "amount"],
        [/^(status|situa[çc][ãa]o)$/i, "status"],
        [/^(vencimento|data|emiss[ãa]o|data emiss[ãa]o|data vencimento|competência|compet[êe]ncia)$/i, "date"],
        [/^(fornecedor|benefici[áa]rio|cliente|favorecido|banco|conta)$/i, "party"],
      ];

      const sync = () => {
        const headers = Array.from(
          table.querySelectorAll<HTMLTableCellElement>("thead th"),
        ).map((th) => (th.getAttribute("data-label") || th.textContent || "").trim());

        const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>(":scope > td"));
          const usedRoles = new Set<string>();
          cells.forEach((cell, i) => {
            const headerText = headers[i] || "";
            const isActionHeader = /^a[çc][õo]es?$/i.test(headerText);
            if (!cell.getAttribute("data-label") && headerText && !isActionHeader) {
              cell.setAttribute("data-label", headerText);
            }
            if (isActionHeader || !headerText) {
              cell.setAttribute("data-role", "actions");
              return;
            }
            // Atribui um "role" semântico para o layout mobile premium
            let role = "";
            for (const [re, r] of ROLE_MAP) {
              if (re.test(headerText) && !usedRoles.has(r)) {
                role = r;
                usedRoles.add(r);
                break;
              }
            }
            if (role) cell.setAttribute("data-role", role);
            else cell.setAttribute("data-role", "detail");
          });
        });
      };


      sync();
      const observer = new MutationObserver(sync);
      observer.observe(table, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, []);

    return (
      <div className="responsive-table-wrapper relative w-full md:overflow-x-auto custom-scrollbar">
        <table
          ref={setRefs}
          className={cn("w-full caption-bottom text-sm md:min-w-max", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b max-md:hidden", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        "[&_tr:last-child]:border-0",
        "max-md:block max-md:space-y-3",
        className,
      )}
      {...props}
    />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const INTERACTIVE = 'button, a, [href], input, select, textarea, [role="checkbox"], [role="menuitem"], [role="menu"], [role="combobox"], [role="dialog"], [data-no-toggle]';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, onClick, ...props }, ref) => {
    const [expanded, setExpanded] = React.useState(false);

    const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest(INTERACTIVE);
      if (!isInteractive && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        setExpanded((v) => !v);
      }
      onClick?.(e);
    };

    return (
      <tr
        ref={ref}
        data-expanded={expanded ? "true" : "false"}
        onClick={handleClick}
        className={cn(
          "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
          className,
        )}
        {...props}
      />
    );
  },
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap first:pl-6 last:pr-6 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("p-4 align-middle first:pl-6 last:pr-6 [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
