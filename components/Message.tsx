import type { ReactNode } from "react";

interface Props {
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}

export function Message({ title, children, action }: Props) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-stone-200 bg-white p-6 text-center dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 text-base text-stone-600 dark:text-stone-400">{children}</div>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 min-h-11 rounded-xl bg-green-700 px-5 text-base font-semibold text-white active:bg-green-800"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
