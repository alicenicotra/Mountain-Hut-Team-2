import { afterEach, describe, expect, it, vi } from "vitest";
import { getSlotMenus } from "../../../src/slots/api/slot-menus-api.ts";

afterEach(() => vi.unstubAllGlobals());

describe("MH-116 slot menu API", () => {
  it("loads saved menus and removes canceled ones from selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, name: "Hut Lunch", type: "TEMPLATE", dishes: [] },
        { id: 2, name: "Vegetarian", type: "MODIFIED", dishes: [] },
        { id: 3, name: "Retired", type: "CANCELED", dishes: [] },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSlotMenus()).resolves.toEqual([
      { id: 1, name: "Hut Lunch", type: "TEMPLATE", dishes: [] },
      { id: 2, name: "Vegetarian", type: "MODIFIED", dishes: [] },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/menus", expect.any(Object));
  });
});
