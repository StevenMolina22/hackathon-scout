import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s) return start;
  const sameYear = e && s.getFullYear() === e.getFullYear();
  const sameMonth = e && sameYear && s.getMonth() === e.getMonth();
  const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
  const fmtMonthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const fmtFull = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!e) return fmtFull.format(s);
  if (sameMonth) return `${fmtMonth.format(s)} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  if (sameYear) return `${fmtMonthDay.format(s)} – ${fmtMonthDay.format(e)}, ${e.getFullYear()}`;
  return `${fmtFull.format(s)} – ${fmtFull.format(e)}`;
}

export function deadlineLabel(deadline: string): { text: string; tone: "urgent" | "soon" | "ok" | "passed" | "unknown" } {
  const d = parseDate(deadline);
  if (!d) return { text: deadline || "no deadline listed", tone: "unknown" };
  const now = Date.now();
  const diff = d.getTime() - now;
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `closed ${Math.abs(days)}d ago`, tone: "passed" };
  if (days === 0) return { text: "closes today", tone: "urgent" };
  if (days <= 7) return { text: `${days}d left`, tone: "urgent" };
  if (days <= 21) return { text: `${days}d left`, tone: "soon" };
  return { text: `${days}d left`, tone: "ok" };
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
