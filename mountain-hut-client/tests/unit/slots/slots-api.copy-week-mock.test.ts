import { afterEach, describe, expect, it, vi } from "vitest";
import { todayString } from "../../../src/shared/utils/date.ts";
import { mondayOf } from "../../../src/slots/utils/week-date.ts";

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("MH-129 mock weekly schedule copy", () => {
  it("replaces existing destination slots instead of returning the old overlap 409", async () => {
    vi.stubEnv("VITE_USE_MOCKS", "true");
    vi.resetModules();
    const { copyWeek, createSlot, getSlots } = await import("../../../src/slots/api/slots-api.ts");

    const sourceDay = todayString();
    const sourceWeekStart = mondayOf(sourceDay);
    const targetWeekStart = addDays(sourceWeekStart, 7);
    const targetDay = addDays(sourceDay, 7);
    const request = { sourceWeekStart, targetWeekStart, weeks: 1 };

    expect((await copyWeek(request)).copiedSlots).toBe(1);
    const previous = await getSlots(targetDay);
    expect(previous).toHaveLength(1);

    await createSlot({ date: targetDay, from: "16:00", to: "18:00", tableIds: [1] });
    expect(await getSlots(targetDay)).toHaveLength(2);

    expect((await copyWeek(request)).copiedSlots).toBe(1);
    const replaced = await getSlots(targetDay);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({ date: targetDay, from: "12:00", to: "14:00" });
    expect(replaced[0].id).not.toBe(previous[0].id);
  });
});
