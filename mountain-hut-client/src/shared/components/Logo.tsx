import logo from "../assets/logo.svg";
import brandIcon from "../assets/brand-icon.svg";

// Full logo (icon + "MOUNTAIN HUT"), used in the navbar. The name is drawn as
// shapes, so a visually hidden text keeps it readable for screen readers and tests.
export default function Logo({ className = "h-10" }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img
        src={logo}
        alt=""
        className={`w-auto transition-transform duration-300 group-hover:-translate-y-0.5 ${className}`}
      />
      <span className="sr-only">Mountain Hut</span>
    </span>
  );
}

// Just the hut-and-mountain mark: footer and other small places
export function BrandIcon({ className = "w-6 h-6" }: { className?: string }) {
  return <img src={brandIcon} alt="" className={`shrink-0 ${className}`} />;
}
