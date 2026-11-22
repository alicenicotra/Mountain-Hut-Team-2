import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon.tsx";

interface SectionTitleProps {
  icon: IconName;
  title: string;
  hint?: ReactNode;
}

// Heading of a card section: icon tile + title, same on every page
export default function SectionTitle({ icon, title, hint }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-800">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        {hint && <p className="text-sm text-stone-500">{hint}</p>}
      </div>
    </div>
  );
}

