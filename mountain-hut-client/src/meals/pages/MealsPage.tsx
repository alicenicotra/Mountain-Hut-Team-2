import { useEffect, useState } from "react";
import AuthShell from "../../shared/components/AuthShell.tsx";
import { todayString } from "../../shared/utils/date.ts";
import { getAllergens } from "../../booking/api/allergens-api.ts";
import type { Allergen } from "../../booking/types/booking.ts";
import { getMeals } from "../api/meals-api.ts";
import AllergenFilter from "../components/AllergenFilter.tsx";
import MenuCard from "../components/MenuCard.tsx";
import type { MealTime } from "../types/meal.ts";
import { dayChipLabel, longDayLabel, nextDays } from "../utils/meal-rules.ts";

const DAYS_SHOWN = 7;

// The meals of the last load, tagged with their day: while it differs from
// the chosen day, that day is still loading
interface LoadedMeals {
  date: string;
  meals: MealTime[];
  error: string | null;
}

export default function MealsPage() {
  const [date, setDate] = useState(todayString);
  const [loaded, setLoaded] = useState<LoadedMeals | null>(null);
  const [allergens, setAllergens] = useState<Allergen[] | null>(null);
  const [allergensError, setAllergensError] = useState(false);
  const [avoid, setAvoid] = useState<number[]>([]);

  useEffect(() => {
    let ignore = false;
    getMeals(date)
      .then((meals) => {
        if (!ignore) setLoaded({ date, meals, error: null });
      })
      .catch((err) => {
        if (!ignore) {
          setLoaded({
            date,
            meals: [],
            error: err instanceof Error ? err.message : "Could not load the meals",
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [date]);

  useEffect(() => {
    let ignore = false;
    getAllergens()
      .then((list) => {
        if (!ignore) setAllergens(list);
      })
      .catch(() => {
        if (!ignore) setAllergensError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function toggleAvoid(id: number) {
    setAvoid((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const today = todayString();
  const days = nextDays(today, DAYS_SHOWN);
  const current = loaded && loaded.date === date ? loaded : null;

  return (
    <AuthShell
      width="4xl"
      badge="Hut kitchen"
      title="Meal times & menus"
      subtitle="See when the hut serves meals and what's on the menu, and find the options that suit your party."
    >
      <div className="space-y-5">
        {/* Day */}
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Day" className="flex flex-wrap gap-2">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={day === date}
                onClick={() => setDate(day)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition cursor-pointer ${
                  day === date
                    ? "bg-green-600 text-white shadow-sm"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-green-600 hover:text-green-700"
                }`}
              >
                {dayChipLabel(day, today)}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm text-stone-600">
            Other day
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-stone-900"
            />
          </label>
        </div>

        <AllergenFilter
          allergens={allergens}
          loadError={allergensError}
          selected={avoid}
          onToggle={toggleAvoid}
          onClear={() => setAvoid([])}
        />

        <h2 className="text-lg font-semibold text-stone-900">{longDayLabel(date)}</h2>

        {current === null && (
          <div className="space-y-3" aria-label="Loading meals">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-stone-200 animate-pulse" />
            ))}
          </div>
        )}

        {current?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            Could not load the meals: {current.error}
          </div>
        )}

        {current && !current.error && current.meals.length === 0 && (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            No meal times on this day.
          </p>
        )}

        {current?.meals.map((meal) => (
          <section key={meal.slotId} aria-label={`Meal ${meal.from}–${meal.to}`} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-green-700">
              {meal.from}–{meal.to}
            </h3>
            {meal.menus.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 px-4 py-4 text-sm text-stone-500">
                The menu for this meal time hasn't been announced yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {meal.menus.map((menu) => (
                  <MenuCard key={menu.id} menu={menu} avoid={avoid} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AuthShell>
  );
}