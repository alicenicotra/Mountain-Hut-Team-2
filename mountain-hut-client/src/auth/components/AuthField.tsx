import type { InputHTMLAttributes } from "react";
import Icon, { type IconName } from "../../shared/components/Icon.tsx";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
}

export default function AuthField({ id, label, hint, icon, className, ...inputProps }: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium text-stone-700 mb-1.5">
        {label}
        {inputProps.required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
        )}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
            <Icon name={icon} className="w-5 h-5" />
          </span>
        )}
        <input
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...inputProps}
          className={`w-full rounded-xl border border-stone-300 bg-white py-2.5 text-base text-stone-900 placeholder:text-stone-400 shadow-xs transition hover:border-green-600 focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/30 ${icon ? "pl-11 pr-3.5" : "px-3.5"} ${className ?? ""}`}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-stone-500">
          {hint}
        </p>
      )}
    </div>
  );
}