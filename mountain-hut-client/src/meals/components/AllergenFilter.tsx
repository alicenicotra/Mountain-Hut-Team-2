import type { Allergen } from "../../booking/types/booking.ts";

interface AllergenFilterProps {
  allergens: Allergen[] | null; // null while loading
  loadError: boolean;
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}

// "Your party avoids": the menus are then marked as suitable or not
export default function AllergenFilter({
  allergens,
  loadError,
  selected,
  onToggle,
  onClear,
}: AllergenFilterProps) {
  return (
    <fieldset className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-green-700">
          Your party avoids
        </legend>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-stone-600 underline hover:text-green-700 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-2 text-sm text-stone-500">
          The allergen list couldn't be loaded. The allergens are still shown on each dish.
        </p>
      )}

      {!loadError && allergens === null && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Loading allergens">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-stone-200 animate-pulse" />
          ))}
        </div>
      )}

      {allergens && (
        <div role="group" aria-label="Allergens to avoid" className="mt-2 flex flex-wrap gap-2">
          {allergens.map((allergen) => {
            const active = selected.includes(allergen.id);
            return (
              <button
                key={allergen.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(allergen.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition cursor-pointer ${
                  active
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-red-400 hover:text-red-700"
                }`}
              >
                {allergen.name}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-stone-500">
        Pick the allergens of your party to see which menus suit you.
      </p>
    </fieldset>
  );
}