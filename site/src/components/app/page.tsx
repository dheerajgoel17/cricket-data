import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export const PageTitle = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <header className="flex flex-col gap-tight">
    <h1 className="text-display font-emphasis tracking-tight">{children}</h1>
    {sub ? <p className="text-callout text-muted-foreground">{sub}</p> : null}
  </header>
);

export const Muted = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-callout text-muted-foreground", className)}>{children}</p>
);

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-hair text-callout text-muted-foreground">
      {items.map(([label, to], i) => (
        <Fragment key={label + i}>
          {i > 0 && <ChevronRightIcon className="size-3.5 opacity-50" aria-hidden />}
          {i === items.length - 1 || !to ? (
            <span className="rounded-full bg-secondary px-snug py-tight font-label text-foreground">{label}</span>
          ) : (
            <Link to={to} className="hover:text-foreground">{label}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** shadcn Card with an optional titled header (hairline under the title) and padded body. */
export function Panel({ title, children, className, flat }: { title?: ReactNode; children: ReactNode; className?: string; flat?: boolean }) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-none", className)}>
      {title ? <h3 className="border-b border-hairline px-inset py-snug text-title font-label">{title}</h3> : null}
      <div className={flat ? "p-0" : "p-inset"}>{children}</div>
    </Card>
  );
}

export const StatTile = ({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) => (
  <Card className="gap-0 px-inset py-snug shadow-none">
    <div className="label-cap text-footnote text-muted-foreground">{k}</div>
    <div className="text-stat font-label leading-tight">{v}</div>
    {s ? <div className="text-footnote text-muted-foreground">{s}</div> : null}
  </Card>
);

export const StatGridCards = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-stack">{children}</div>
);

export const Chips = ({ list }: { list: [string, unknown][] }) => (
  <div className="flex flex-wrap gap-hair">
    {list.map(([k, v], i) => (
      <Badge key={i} variant="secondary" className="rounded-full px-snug py-tight text-callout font-copy">
        {k ? <b className="mr-hair font-label text-muted-foreground">{k}:</b> : null}
        {String(v)}
      </Badge>
    ))}
  </div>
);

export const OddsText = ({ children }: { children: ReactNode }) => <span className="font-label tabular-nums text-primary">{children}</span>;

/** Dense stats-table header: label-cap + footnote. Shared by DataTable and the Player Lines ladder. */
export const TABLE_HEAD =
  "h-auto px-snug py-tight text-left label-cap text-footnote font-label text-muted-foreground";

/** Phone edge bleed for stats tables / game logs: full-bleed hairlines, inset again from `lg`. */
export const TABLE_BLEED = "-mx-gutter border-y border-hairline lg:mx-0";

/** Simple data table on shadcn's Table: columns are labels, rows are arrays of cells. `bleed` applies the Player Props edge contract. */
export function DataTable({
  columns,
  rows,
  className,
  bleed,
}: {
  columns: ReactNode[];
  rows: ReactNode[][];
  className?: string;
  /** Full-bleed on phone (`-mx-gutter` + hairlines); flush from `lg`. */
  bleed?: boolean;
}) {
  const table = (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c, i) => (
            <TableHead key={i} className={cn(TABLE_HEAD, i > 0 && "text-right", bleed && i === 0 && "pl-gutter", bleed && i === columns.length - 1 && "pr-gutter")}>
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className="min-h-row">
            {r.map((c, j) => (
              <TableCell key={j} className={cn("whitespace-nowrap tabular-nums", j > 0 && "text-right", bleed && j === 0 && "pl-gutter", bleed && j === r.length - 1 && "pr-gutter")}>
                {c ?? "–"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return bleed ? <div className={TABLE_BLEED}>{table}</div> : table;
}

/** @deprecated Prefer `EmptyState` with a title and body. */
export const EmptyNote = ({ children, title }: { children: ReactNode; title?: string }) => (
  <EmptyState compact title={title || children} body={title ? children : undefined} />
);
