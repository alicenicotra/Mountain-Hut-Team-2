import type { ReactNode } from "react";

export default function Step({ number, title, actions, children }: {
  number: number;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-linear-to-br from-green-600 to-green-800 text-white text-sm font-bold flex items-center justify-center shadow-sm">
          {number}
        </span>
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="sm:pl-10 space-y-3">{children}</div>
    </div>
  );
}
