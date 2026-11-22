import { ApiError, apiFetch } from "../../shared/api/client.ts";
import type { CreateDishRequest, CreateMenuRequest, Dish, Menu } from "../types/menu.ts";

export const isMenuMockMode = import.meta.env.VITE_USE_MOCKS === "true";

// Demo data exists only when VITE_USE_MOCKS=true; never show it as server data.
const mockDishes: Dish[] = [
  { id: 1, name: "Vegetable soup", description: "Seasonal vegetables", course: "APPETIZER", ingredients: ["Carrot", "Potato"] },
  { id: 2, name: "Polenta with cheese", description: "Traditional mountain dish", course: "MAIN", ingredients: ["Corn", "Cheese"] },
  { id: 3, name: "Grilled vegetables", description: null, course: "SIDE", ingredients: ["Zucchini", "Pepper"] },
  { id: 4, name: "Apple cake", description: null, course: "DESSERT", ingredients: ["Apple", "Flour"] },
  { id: 5, name: "Lentil stew", description: null, course: "MAIN", ingredients: ["Lentils", "Tomato"] },
  { id: 6, name: "Herbal tea", description: null, course: "BEVERAGE", ingredients: ["Herbs"] },
];
const mockMenus: Menu[] = [
  { id: 1, name: "Regular", type: "TEMPLATE", dishes: [mockDishes[0], mockDishes[1], mockDishes[3], mockDishes[5]] },
  { id: 2, name: "Vegan", type: "TEMPLATE", dishes: [mockDishes[0], mockDishes[4], mockDishes[2], mockDishes[5]] },
  { id: 3, name: "Vegetarian", type: "TEMPLATE", dishes: [mockDishes[0], mockDishes[1], mockDishes[2], mockDishes[3]] },
  { id: 4, name: "Vegetarian with tomini", type: "MODIFIED", dishes: [mockDishes[0], mockDishes[1], mockDishes[2]] },
];

export async function getMenus(): Promise<Menu[]> {
  if (isMenuMockMode) {
    return mockMenus.filter((menu) => menu.type !== "CANCELED").map((menu) => ({
      ...menu,
      dishes: menu.dishes.map((dish) => ({ ...dish })),
    }));
  }
  const result = await apiFetch<Menu[]>("/menus");
  return result.filter((menu) => menu.type !== "CANCELED");
}

export async function getDishes(): Promise<Dish[]> {
  if (isMenuMockMode) return mockDishes.map((dish) => ({ ...dish }));
  return apiFetch<Dish[]>("/dishes");
}

export async function createMenu(input: CreateMenuRequest): Promise<{ id: number }> {
  if (isMenuMockMode) {
    const name = input.name.trim();
    if (!name) throw new ApiError(400, "A menu name is required");
    if (mockMenus.some((menu) => menu.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, "A menu with this name already exists");
    }
    if (new Set(input.dishes).size !== input.dishes.length) {
      throw new ApiError(400, "Each dish can only appear once in a menu");
    }
    const selected = input.dishes.map((id) => mockDishes.find((dish) => dish.id === id));
    if (selected.some((dish) => dish === undefined)) throw new ApiError(400, "Unknown dish");
    const id = Math.max(0, ...mockMenus.map((menu) => menu.id)) + 1;
    mockMenus.push({ id, name, type: "MODIFIED", dishes: selected as Dish[] });
    return { id };
  }
  return apiFetch<{ id: number }>("/menus", {
    method: "POST", body: JSON.stringify(input),
  });
}

export async function createDish(input: CreateDishRequest): Promise<Dish> {
  if (!isMenuMockMode) {
    // MH-10 currently only exposes GET /dishes. Never pretend that edits were saved.
    throw new Error("Dish creation is not available yet: the backend needs POST /dishes and ingredient support.");
  }
  const name = input.name.trim();
  if (!name) throw new ApiError(400, "A dish name is required");
  if (mockDishes.some((dish) => dish.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, "A dish with this name already exists");
  }
  const id = Math.max(0, ...mockDishes.map((dish) => dish.id)) + 1;
  const dish: Dish = { ...input, name, id };
  mockDishes.push(dish);
  return { ...dish };
}
