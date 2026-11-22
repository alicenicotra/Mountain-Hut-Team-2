import { Link } from "react-router";
import Icon from "../components/Icon.tsx";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      {/* Lost trail: a dashed path that ends at a mountain */}
      <svg viewBox="0 0 240 120" className="w-72 max-w-full" aria-hidden="true">
        <path d="M0 110 L60 50 L95 85 L150 25 L240 110 Z" fill="#dcfce7" />
        <path d="M150 25 L136 45 L144 42 L150 52 L156 42 L164 45 Z" fill="#ffffff" />
        <path d="M60 50 L51 62 L57 60 L60 66 L64 60 L69 62 Z" fill="#ffffff" />
        <path
          d="M20 112 C60 95 90 108 120 92 S170 80 200 96"
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
          strokeDasharray="6 7"
          strokeLinecap="round"
        />
        <circle cx="200" cy="96" r="7" fill="#f59e0b" />
        <path d="M197 93 L203 99 M203 93 L197 99" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <p className="mt-6 text-6xl font-extrabold tracking-tight text-green-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900">Not Found</h1>
      <p className="mt-2 max-w-md text-base text-stone-600">
        This trail doesn't lead anywhere. The page may have moved, or the address has a typo.
      </p>

      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-800 hover:shadow-lg hover:-translate-y-0.5"
      >
        <Icon name="chevronLeft" className="w-5 h-5" />
        Back to the hut
      </Link>
    </div>
  );
}
