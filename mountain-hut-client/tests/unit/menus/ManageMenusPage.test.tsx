import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManageMenusPage from "../../../src/menus/pages/ManageMenusPage.tsx";
import { createDish, createMenu, getDishes, getMenus } from "../../../src/menus/api/menus-api.ts";
import type { Dish, Menu } from "../../../src/menus/types/menu.ts";

vi.mock("../../../src/menus/api/menus-api.ts", () => ({
  getMenus: vi.fn(), getDishes: vi.fn(), createMenu: vi.fn(), createDish: vi.fn(),
  isMenuMockMode: true,
}));

const dishes: Dish[] = [
  { id: 1, name: "Vegetable soup", description: null, course: "APPETIZER" },
  { id: 2, name: "Polenta", description: null, course: "MAIN" },
  { id: 3, name: "Apple cake", description: null, course: "DESSERT" },
];
const menus: Menu[] = [
  { id: 11, name: "Regular", type: "TEMPLATE", dishes: [dishes[0], dishes[1]] },
  { id: 12, name: "Vegetarian", type: "TEMPLATE", dishes: [dishes[0], dishes[2]] },
  { id: 13, name: "Custom test", type: "MODIFIED", dishes: [dishes[2]] },
  { id: 14, name: "Old menu", type: "CANCELED", dishes: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMenus).mockResolvedValue(menus);
  vi.mocked(getDishes).mockResolvedValue(dishes);
});

describe("MH-162 Manage Menus page", () => {
  it("separates default and custom menus, excluding canceled ones", async () => {
    render(<ManageMenusPage />);
    const defaults = await screen.findByRole("region", { name: "Default menus" });
    const custom = screen.getByRole("region", { name: "Custom menus" });
    expect(within(defaults).getByRole("button", { name: "Regular" })).toHaveAttribute("aria-pressed", "true");
    expect(within(defaults).getByRole("button", { name: "Vegetarian" })).toBeInTheDocument();
    expect(within(custom).getByRole("button", { name: "Custom test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Old menu" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Course 1")).toHaveValue("1");
    expect(screen.getByLabelText("Course 2")).toHaveValue("2");
  });

  it("switches menus and creates a custom copy without overwriting a template", async () => {
    const user = userEvent.setup();
    vi.mocked(createMenu).mockResolvedValue({ id: 20 });
    vi.mocked(getMenus)
      .mockResolvedValueOnce(menus)
      .mockResolvedValueOnce([...menus, { id: 20, name: "Veg custom", type: "MODIFIED", dishes: [dishes[0], dishes[2]] }]);
    render(<ManageMenusPage />);
    await user.click(await screen.findByRole("button", { name: "Vegetarian" }));
    expect(screen.getByRole("heading", { name: "Customize Vegetarian" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Menu name"));
    await user.type(screen.getByLabelText("Menu name"), "Veg custom");
    await user.click(screen.getByRole("button", { name: "Save as custom menu" }));
    expect(createMenu).toHaveBeenCalledWith({ name: "Veg custom", type: "MODIFIED", dishes: [1, 3] });
    expect(await screen.findByRole("button", { name: "Veg custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/created\./)).toBeInTheDocument();
  });

  it("allows creating a new menu with a selected dish", async () => {
    const user = userEvent.setup();
    vi.mocked(createMenu).mockResolvedValue({ id: 21 });
    render(<ManageMenusPage />);
    await user.click(await screen.findByRole("button", { name: /New menu/i }));
    expect(screen.getByRole("button", { name: "Create menu" })).toBeDisabled();
    await user.type(screen.getByLabelText("Menu name"), "My menu");
    await user.selectOptions(screen.getByLabelText("Course 1"), "2");
    await user.click(screen.getByRole("button", { name: "Create menu" }));
    expect(createMenu).toHaveBeenCalledWith({ name: "My menu", type: "MODIFIED", dishes: [2] });
  });

  it("shows a backend rejection instead of showing success", async () => {
    const user = userEvent.setup();
    vi.mocked(createMenu).mockRejectedValue(new Error("A menu with this name already exists"));
    render(<ManageMenusPage />);
    await user.click(await screen.findByRole("button", { name: "Save as custom menu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.queryByText(/created\./)).not.toBeInTheDocument();
  });

  it("adds a dish and makes it selectable in a course", async () => {
    const user = userEvent.setup();
    const added: Dish = { id: 6, name: "Gnocchi", description: null, course: "MAIN", ingredients: ["Cheese"] };
    vi.mocked(createDish).mockResolvedValue(added);
    render(<ManageMenusPage />);
    await user.click(await screen.findByRole("button", { name: /Define new dish/i }));
    await user.type(screen.getByLabelText("Dish name"), "Gnocchi");
    await user.click(screen.getByRole("checkbox", { name: "Cheese" }));
    await user.click(screen.getByRole("button", { name: "Save dish" }));
    expect(createDish).toHaveBeenCalledWith({ name: "Gnocchi", description: null, course: "MAIN", ingredients: ["Cheese"] });
    expect(await screen.findByText(/Dish "Gnocchi" added/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Course 3")).getByRole("option", { name: /Gnocchi/ })).toBeInTheDocument();
  });

  it("provides a retry when loading fails", async () => {
    vi.mocked(getMenus).mockRejectedValueOnce(new Error("Backend unavailable")).mockResolvedValueOnce(menus);
    render(<ManageMenusPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Backend unavailable");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Regular" })).toBeInTheDocument();
  });
});
