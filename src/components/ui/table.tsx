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

      const sync = () => {
        const headers = Array.from(
          table.querySelectorAll<HTMLTableCellElement>("thead th"),
        ).map((th) => (th.getAttribute("data-label") || th.textContent || "").trim());

        const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>(":scope > td"));
          let dataIdx = 0;
          cells.forEach((cell, i) => {
            // injeta o label baseado no thead
            if (!cell.getAttribute("data-label") && headers[i]) {
              cell.setAttribute("data-label", headers[i]);
            }
            // identifica células "essenciais" vs colapsáveis
            const isCheckbox = !!cell.querySelector('[role="checkbox"]');
            const hidden = cell.hasAttribute("data-mobile-hide");
            const always = cell.hasAttribute("data-mobile-always");
            if (isCheckbox || hidden || always) return;
            dataIdx++;
            if (dataIdx > 2) cell.setAttribute("data-mobile-collapsible", "");
            else cell.removeAttribute("data-mobile-collapsible");
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
        "max-md:block max-md:space-y-2",
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
          // ===== Mobile: card premium =====
          "max-md:relative max-md:block max-md:rounded-2xl max-md:border max-md:border-border/60",
          "max-md:bg-gradient-to-b max-md:from-card max-md:to-card/70 max-md:backdrop-blur-sm",
          "max-md:px-4 max-md:pt-3 max-md:pb-11",
          "max-md:shadow-[0_1px_0_0_hsl(var(--border)/0.3),0_8px_24px_-12px_rgba(0,0,0,0.5)]",
          "max-md:hover:border-border max-md:active:scale-[0.997] max-md:transition-all max-md:cursor-pointer",
          // Pill chevron na base
          "max-md:after:content-[''] max-md:after:absolute max-md:after:left-1/2 max-md:after:-translate-x-1/2",
          "max-md:after:bottom-3 max-md:after:w-2 max-md:after:h-2",
          "max-md:after:border-r-[1.5px] max-md:after:border-b-[1.5px] max-md:after:border-muted-foreground",
          "max-md:after:rotate-45 max-md:after:transition-transform max-md:after:duration-200",
          "max-md:data-[expanded=true]:after:-rotate-[135deg] max-md:data-[expanded=true]:after:translate-y-1",
          // Pill background atrás do chevron
          "max-md:before:content-[''] max-md:before:absolute max-md:before:left-1/2 max-md:before:-translate-x-1/2",
          "max-md:before:bottom-1.5 max-md:before:w-10 max-md:before:h-6 max-md:before:rounded-full",
          "max-md:before:bg-muted/40 max-md:before:border max-md:before:border-border/50",
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
      className={cn(
        "p-4 align-middle first:pl-6 last:pr-6 [&:has([role=checkbox])]:pr-0",
        // ===== Mobile: linha label/valor =====
        "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3",
        "max-md:py-2 max-md:px-0 max-md:min-h-[34px]",
        "max-md:border-b max-md:border-border/30 max-md:last:border-b-0",
        "max-md:text-right max-md:text-[13px] max-md:font-medium max-md:text-foreground",
        // Label (pseudo)
        "max-md:before:content-[attr(data-label)] max-md:before:text-muted-foreground/80",
        "max-md:before:text-[10.5px] max-md:before:uppercase max-md:before:tracking-[0.08em]",
        "max-md:before:font-semibold max-md:before:text-left max-md:before:shrink-0",
        "max-md:before:mr-3",
        // Flags
        "max-md:[&[data-mobile-hide]]:hidden",
        "max-md:[&:not([data-label])]:before:hidden",
        "max-md:[&:not([data-label])]:justify-start",
        // Checkbox sozinho — sem borda nem padding
        "max-md:[&:has([role=checkbox])]:border-b-0 max-md:[&:has([role=checkbox])]:py-0 max-md:[&:has([role=checkbox])]:min-h-0",
        "max-md:[&:has([role=checkbox])]:absolute max-md:[&:has([role=checkbox])]:top-3 max-md:[&:has([role=checkbox])]:right-3",
        className,
      )}
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
