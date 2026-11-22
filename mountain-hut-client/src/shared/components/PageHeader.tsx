import type { ReactNode } from "react";
import backgroundImage from "../assets/BackgroundMountainHut.jpeg";
import Icon, { type IconName } from "./Icon.tsx";

interface PageHeaderProps {
  icon: IconName;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

// Photo banner shared by the inner pages, matching the home and login look
export default function PageHeader({ icon, eyebrow, title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-2xl shadow-md animate-fade-up">
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-r from-green-950/90 via-green-900/70 to-green-900/20" />

      <div className="relative flex flex-wrap items-center gap-4 px-6 py-6 sm:px-8 text-white">
        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 shadow-md animate-pop-in">
          <Icon name={icon} className="w-6 h-6" />
        </span>
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-200">
            {eyebrow}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-md">{title}</h1>
          {subtitle && <p className="text-base text-green-50/90">{subtitle}</p>}
        </div>
        {children && <div className="sm:ml-auto">{children}</div>}
      </div>
    </header>
  );
}
