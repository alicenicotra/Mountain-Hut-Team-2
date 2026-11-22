import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MenuEditor from "../../../src/menus/components/MenuEditor.tsx";
import DishForm from "../../../src/menus/components/DishForm.tsx";
import type { Dish, Menu } from "../../../src/menus/types/menu.ts";

const dishes: Dish[] = [
  { id: 1, name: "Soup", description: null, course: "APPETIZER" },
  { id: 2, name: "Polenta", description: null, course: "MAIN" },
];
const menu: Menu = { id: 1, name: "Regular", type: "TEMPLATE", dishes: [dishes[0]] };

describe("MH-162 menu editor", () => {
  it("prevents duplicate dishes in a menu", async () => {
    render(<MenuEditor menu={menu} dishes={dishes} onSave={vi.fn()} onNewDish={vi.fn()} />);
    const otherCourse = screen.getByLabelText("Course 2");
    expect(otherCourse.querySelector('option[value="1"]')).toBeNull();
    await userEvent.setup().selectOptions(otherCourse, "2");
    expect(screen.getByRole("button", { name: "Save as custom menu" })).toBeEnabled();
  });

  it("shows a save error without clearing user selections", async () => {
    const save = vi.fn().mockRejectedValue(new Error("API not available"));
    render(<MenuEditor menu={menu} dishes={dishes} onSave={save} onNewDish={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save as custom menu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("API not available");
    expect(screen.getByLabelText("Course 1")).toHaveValue("1");
  });

  it("does not allow the backend-only dish form to claim it saved", () => {
    render(<DishForm available={false} onCreate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save dish" })).toBeDisabled();
    expect(screen.getByText(/Preview only/)).toBeInTheDocument();
  });
});
