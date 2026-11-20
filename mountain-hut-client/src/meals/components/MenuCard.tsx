import type { MealMenu } from "../types/meal.ts";
import { COURSE_LABELS, conflictingAllergens, groupByCourse } from "../utils/meal-rules.ts";

interface MenuCardProps {
  menu: MealMenu;
  avoid: number[];
}

export default function MenuCard({ menu, avoid }: MenuCardProps) {
  const conflicts = conflictingAllergens(menu.allergens, avoid);
  const suits = avoid.length > 0 && conflicts.length === 0;

  return (
    <article
      aria-label={menu.name}
      className={`rounded-lg border bg-white px-4 py-3 shadow-xs ${
        avoid.length === 0
          ? "border-stone-200"
          : suits
            ? "border-green-400"
            : "border-amber-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-stone-900">{menu.name}</h3>
        {suits && (
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            ✓ Suits your party
          </span>
        )}
        {conflicts.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Contains {conflicts.map((a) => a.name).join(", ")}
          </span>
        )}
      </div>

      <p className="mt-0.5 text-xs text-stone-500">
        {menu.allergens.length > 0
          ? `Allergens: ${menu.allergens.map((a) => a.name).join(", ")}`
          : "No listed allergens"}
      </p>

      <div className="mt-3 space-y-3">
        {groupByCourse(menu.dishes).map(({ course, dishes }) => (
          <div key={course}>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {COURSE_LABELS[course]}
            </p>
            <ul className="mt-1 space-y-1.5">
              {dishes.map((dish) => (
                <li key={dish.id}>
                  <p className="text-sm font-medium text-stone-900">{dish.name}</p>
                  {dish.description && (
                    <p className="text-xs text-stone-600">{dish.description}</p>
                  )}
                  {dish.allergens.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dish.allergens.map((allergen) => (
                        <span
                          key={allergen.id}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            avoid.includes(allergen.id)
                              ? "bg-red-100 text-red-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {allergen.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}