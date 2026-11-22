// Contracts from the menu backend currently under development (MH-10).
export type MenuType = "TEMPLATE" | "MODIFIED" | "CANCELED";
export type DishCourse = "APPETIZER" | "MAIN" | "SIDE" | "DESSERT" | "BEVERAGE";

export const DISH_COURSES: DishCourse[] = [
  "APPETIZER", "MAIN", "SIDE", "DESSERT", "BEVERAGE",
];

export interface Dish {
  id: number;
  name: string;
  description: string | null;
  course: DishCourse;
  // Preview-only until the backend supports ingredients (not equivalent to allergens).
  ingredients?: string[];
}

export interface Menu {
  id: number;
  name: string;
  type: MenuType;
  dishes: Dish[];
}

export interface CreateMenuRequest {
  name: string;
  type: "MODIFIED";
  dishes: number[];
}

export interface CreateDishRequest {
  name: string;
  description: string | null;
  course: DishCourse;
  ingredients: string[];
}
