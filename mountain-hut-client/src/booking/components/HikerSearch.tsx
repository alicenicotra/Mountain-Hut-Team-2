import { useEffect, useState } from "react";
import { searchHikers } from "../api/hikers-api.ts";
import type { HikerMatch } from "../types/hiker.ts";
import Icon from "../../shared/components/Icon.tsx";
import { inputBase } from "../../shared/styles.ts";

interface HikerSearchProps {
  onSelect: (hiker: HikerMatch) => void;
}

interface SearchResult {
  term: string;
  hikers: HikerMatch[];
  error: string | null;
}

const MIN_LENGTH = 2;

export default function HikerSearch({ onSelect }: HikerSearchProps) {
  const [query, setQuery] = useState("");
  // Remembers which text the results belong to, as in the slots page
  const [result, setResult] = useState<SearchResult | null>(null);

  const term = query.trim();
  const longEnough = term.length >= MIN_LENGTH;

  useEffect(() => {
    if (term.length < MIN_LENGTH) return;
    let ignore = false;

    // Waits for a pause in the typing, not one request per letter
    const timer = setTimeout(() => {
      searchHikers(term)
        .then((hikers) => {
          if (!ignore) setResult({ term, hikers, error: null });
        })
        .catch((err: Error) => {
          if (!ignore) setResult({ term, hikers: [], error: err.message });
        });
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [term]);

  const current = result?.term === term ? result : null;

  return (
    <div className="space-y-3">
      <label className="flex flex-col text-sm font-medium text-stone-700">
        Name, phone or email
        <span className="relative mt-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
            <Icon name="search" className="w-5 h-5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`w-full pl-11 ${inputBase}`}
          />
        </span>
      </label>

      {longEnough && !current && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span className="w-4 h-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin" aria-hidden="true" />
          <p>Searching…</p>
        </div>
      )}
      {current?.error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          <p>Error: {current.error}</p>
        </div>
      )}
      {current && !current.error && current.hikers.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-stone-300 px-4 py-4 text-center text-sm text-stone-500">No hiker found: enter the whole name, phone or email</p>
      )}

      {current && current.hikers.length > 0 && (
        <ul className="space-y-2">
          {current.hikers.map((hiker, index) => (
            <li key={hiker.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-up">
              <button
                type="button"
                onClick={() => onSelect(hiker)}
                className="group flex w-full items-center gap-3 text-left rounded-xl border-2 border-stone-200 bg-white p-3.5 transition-all hover:border-green-600 hover:shadow-md cursor-pointer"
              >
                <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-green-100 font-semibold text-green-800" aria-hidden="true">
                  {hiker.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">
                  {hiker.name} {hiker.surname}
                </span>
                <span className="block text-sm text-stone-600">
                  {/* "Just a name" hikers have no email, and may have no phone */}
                  {[hiker.email, hiker.phoneNumber].filter(Boolean).join(" · ")}
                </span>
                </span>
                <Icon name="chevronRight" className="w-5 h-5 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-green-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
