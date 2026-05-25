import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabela responsiva global.
 * - Desktop (md+): comportamento normal com scroll horizontal se preciso.
 * - Mobile (<md): cada <tr> vira um card empilhado. Cada <td> mostra o
 *   rótulo da coluna (extraído do <thead>) à esquerda e o valor à direita.
 *   Resultado: ZERO scroll horizontal e nenhuma coluna "quebrada".
 *
 * Para suprimir uma coluna no mobile: adicione `data-mobile-hide` no <th> ou <td>.
 * Para forçar uma célula a ocupar toda a linha no mobile: `data-mobile-full`.
 */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTableElement | null>(null);
    const setRefs = (node: HTMLTableElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTableElement | null>).current = node;
    };

    // Copia o texto de cada <th> para o atributo data-label da <td> correspondente,
    // permitindo o layout "card" no mobile via CSS puro.
    React.useEffect(() => {
      const table = innerRef.current;
      if (!table) return;

      const sync = () => {
        const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
          (th) => (th.getAttribute("data-label") || th.textContent || "").trim(),
        );
        if (headers.length === 0) return;
        const rows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
        rows.forEach((row) => {
          const cells = row.querySelectorAll<HTMLTableCellElement>(":scope > td");
          cells.forEach((cell, i) => {
            if (!cell.getAttribute("data-label") && headers[i]) {
              cell.setAttribute("data-label", headers[i]);
            }
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

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
        // Mobile: cada linha vira um card empilhado
        "max-md:block max-md:rounded-xl max-md:border max-md:border-border/50",
        "max-md:bg-card/60 max-md:backdrop-blur-sm max-md:p-3 max-md:shadow-sm",
        "max-md:hover:bg-card/80",
        className,
      )}
      {...props}
    />
  ),
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
        // Mobile: célula vira linha label/valor dentro do card
        "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3",
        "max-md:py-1.5 max-md:px-0 max-md:first:pl-0 max-md:last:pr-0",
        "max-md:text-right max-md:text-sm",
        "max-md:before:content-[attr(data-label)] max-md:before:text-muted-foreground",
        "max-md:before:text-[11px] max-md:before:uppercase max-md:before:tracking-wider",
        "max-md:before:font-medium max-md:before:text-left max-md:before:shrink-0",
        "max-md:before:mr-2",
        "max-md:[&[data-mobile-hide]]:hidden",
        "max-md:[&[data-mobile-full]]:before:hidden max-md:[&[data-mobile-full]]:block",
        "max-md:[&[data-mobile-full]]:text-left max-md:[&[data-mobile-full]]:pt-2",
        "max-md:[&:not([data-label])]:before:hidden",
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
