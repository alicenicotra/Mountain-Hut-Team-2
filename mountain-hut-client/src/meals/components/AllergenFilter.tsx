import type { Allergen } from "../../booking/types/booking.ts";
import Icon from "../../shared/components/Icon.tsx";

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
    <fieldset className="rounded-2xl border border-stone-200 bg-linear-to-br from-stone-50 to-white px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <legend className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-700">
          <Icon name="shield" className="w-5 h-5" />
          Your party avoids
        </legend>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-green-700 cursor-pointer motion-safe:animate-pop-in"
          >
            <Icon name="close" className="w-4 h-4" />
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
        <div role="group" aria-label="Allergens to avoid" className="mt-3 flex flex-wrap gap-2">
          {allergens.map((allergen) => {
            const active = selected.includes(allergen.id);
            return (
              <button
                key={allergen.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(allergen.id)}
                className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-200 cursor-pointer motion-safe:active:scale-95 ${
                  active
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-red-400 hover:text-red-700"
                }`}
              >
                {allergen.name}
                {active && <Icon name="close" className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-sm text-stone-500">
        Pick the allergens of your party to see which menus suit you.
      </p>
    </fieldset>
  );
}