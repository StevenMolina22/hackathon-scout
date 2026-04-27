import Link from "next/link";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Preferences } from "@scout/core/schemas";

export function PrefsSummary({ prefs }: { prefs: Preferences }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Searching for
        </span>
        {prefs.topics.map((t) => (
          <Badge key={t} variant="default" className="font-medium">
            {t}
          </Badge>
        ))}
        <Badge variant="outline">{prefs.region}</Badge>
        <Badge variant="outline">next {prefs.withinDays}d</Badge>
        {prefs.remoteOnly && <Badge variant="secondary">remote only</Badge>}
        {prefs.studentFriendly && <Badge variant="secondary">student-friendly</Badge>}
        <Badge variant="secondary" className="font-mono">
          top {prefs.maxResults}
        </Badge>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        <Pencil className="h-3 w-3" aria-hidden />
        Edit search
      </Link>
    </div>
  );
}
