import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const PageTitle = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <header className="mb-4"><h1 className="text-2xl font-medium tracking-tight md:text-3xl">{children}</h1>{sub ? <p className="mt-1 text-muted-foreground">{sub}</p> : null}</header>
);

export const Muted = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="my-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {items.map(([label, to], i) => (
        <Fragment key={label + i}>
          {i > 0 && <ChevronRight className="size-3.5 opacity-50" />}
          {i === items.length - 1 || !to ? <span className="rounded-full bg-secondary px-3 py-1 font-medium text-foreground">{label}</span> : <Link to={to} className="hover:text-foreground">{label}</Link>}
        </Fragment>
      ))}
    </nav>
  );
}

/** shadcn Card with an optional titled header (hairline under the title) and padded body. */
export function Panel({ title, children, className, flat }: { title?: ReactNode; children: ReactNode; className?: string; flat?: boolean }) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-none", className)}>
      {title ? <h3 className="border-b px-4 py-3 text-lg font-medium">{title}</h3> : null}
      <div className={flat ? "p-0" : "p-4"}>{children}</div>
    </Card>
  );
}

export const StatTile = ({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) => (
  <Card className="gap-0 px-4 py-3 shadow-none">
    <div className="font-condensed text-[13px] uppercase tracking-wide text-muted-foreground">{k}</div>
    <div className="text-2xl font-medium leading-tight">{v}</div>
    {s ? <div className="text-xs text-muted-foreground">{s}</div> : null}
  </Card>
);
export const StatGridCards = ({ children }: { children: ReactNode }) => <div className="my-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">{children}</div>;

export const Chips = ({ list }: { list: [string, unknown][] }) => (
  <div className="my-2 flex flex-wrap gap-1.5">{list.map(([k, v], i) => <Badge key={i} variant="secondary" className="rounded-full px-3 py-1 text-[13px] font-normal">{k ? <b className="mr-1 font-semibold text-muted-foreground">{k}:</b> : null}{String(v)}</Badge>)}</div>
);

export const OddsText = ({ children }: { children: ReactNode }) => <span className="font-semibold tabular-nums text-primary">{children}</span>;

/** Simple data table on shadcn's Table: columns are labels, rows are arrays of cells. */
export function DataTable({ columns, rows, className }: { columns: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <Table className={className}>
      <TableHeader><TableRow className="hover:bg-transparent">{columns.map((c, i) => <TableHead key={i} className={cn("font-condensed text-[13px] font-normal uppercase tracking-wide text-muted-foreground", i > 0 && "text-right")}>{c}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={cn("whitespace-nowrap tabular-nums", j > 0 && "text-right")}>{c ?? "–"}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  );
}

export const EmptyNote = ({ children }: { children: ReactNode }) => <Card className="px-4 py-3 text-muted-foreground shadow-none">{children}</Card>;
