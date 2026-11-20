import type { Course, MealAllergen, MealDish } from "../types/meal.ts";

export const COURSE_ORDER: Course[] = ["APPETIZER", "MAIN", "SIDE", "DESSERT", "BEVERAGE"];

export const COURSE_LABELS: Record<Course, string> = {
  APPETIZER: "Appetizers",
  MAIN: "Mains",
  SIDE: "Sides",
  DESSERT: "Desserts",
  BEVERAGE: "Drinks",
};

// The dishes split by course, in serving order, without empty courses
export function groupByCourse(dishes: MealDish[]): { course: Course; dishes: MealDish[] }[] {
  return COURSE_ORDER.map((course) => ({
    course,
    dishes: dishes.filter((dish) => dish.course === course),
  })).filter((group) => group.dishes.length > 0);
}

// The allergens of a menu or dish that the party wants to avoid
export function conflictingAllergens(allergens: MealAllergen[], avoid: number[]): MealAllergen[] {
  return allergens.filter((allergen) => avoid.includes(allergen.id));
}

// Date-only arithmetic in UTC, so it is the same in every time zone
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextDays(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

// "Today", "Tomorrow", then "Mon 23 Nov"
export function dayChipLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// "Saturday 21 November"
export function longDayLabel(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}