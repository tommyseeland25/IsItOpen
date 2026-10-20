import type { OpenState } from "../lib/hours";

const STYLES: Record<OpenState, string> = {
  open: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300 ring-green-600/30",
  closed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 ring-red-600/30",
  unknown: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300 ring-stone-500/30",
};

const ICONS: Record<OpenState, string> = { open: "✓", closed: "✕", unknown: "?" };

export function StatusBadge({ state, label }: { state: OpenState; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset ${STYLES[state]}`}
    >
      <span aria-hidden="true">{ICONS[state]}</span>
      {label}
    </span>
  );
}
