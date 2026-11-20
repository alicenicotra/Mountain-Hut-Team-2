import { describe, expect, it } from "vitest";
import {
  addDays,
  conflictingAllergens,
  dayChipLabel,
  groupByCourse,
  longDayLabel,
  nextDays,
} from "../../../src/meals/utils/meal-rules.ts";
import type { Course, MealDish } from "../../../src/meals/types/meal.ts";

const dish = (id: number, name: string, course: Course): MealDish => ({
  id,
  name,
  description: null,
  course,
  allergens: [],
});

describe("MH-134 meal rules", () => {
  it("groups the dishes by course in serving order, without empty courses", () => {
    const groups = groupByCourse([
      dish(1, "Strudel", "DESSERT"),
      dish(2, "Tagliere", "APPETIZER"),
      dish(3, "Canederli", "MAIN"),
      dish(4, "Polenta", "MAIN"),
    ]);

    expect(groups.map((g) => g.course)).toEqual(["APPETIZER", "MAIN", "DESSERT"]);
    expect(groups[1].dishes.map((d) => d.name)).toEqual(["Canederli", "Polenta"]);
  });

  it("finds the allergens the party wants to avoid", () => {
    const allergens = [
      { id: 1, name: "Milk" },
      { id: 6, name: "Wheat" },
    ];

    expect(conflictingAllergens(allergens, [6, 2])).toEqual([{ id: 6, name: "Wheat" }]);
    expect(conflictingAllergens(allergens, [])).toEqual([]);
    expect(conflictingAllergens([], [1])).toEqual([]);
  });

  it("counts days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(nextDays("2026-11-29", 3)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("labels the days for the day buttons", () => {
    expect(dayChipLabel("2026-11-21", "2026-11-21")).toBe("Today");
    expect(dayChipLabel("2026-11-22", "2026-11-21")).toBe("Tomorrow");
    expect(dayChipLabel("2026-11-23", "2026-11-21")).toMatch(/^Mon,? 23 Nov$/);
    expect(longDayLabel("2026-11-21")).toMatch(/^Saturday,? 21 November$/);
  });
});