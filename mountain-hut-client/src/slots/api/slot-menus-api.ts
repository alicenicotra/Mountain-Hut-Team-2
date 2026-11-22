import { apiFetch } from "../../shared/api/client.ts";

export interface SlotMenu {
  id: number;
  name: string;
  type: "TEMPLATE" | "MODIFIED";
}

type MenuResponse = SlotMenu | { id: number; name: string; type: "CANCELED" };

export async function getSlotMenus(): Promise<SlotMenu[]> {
  const menus = await apiFetch<MenuResponse[]>("/menus");
  return menus.filter((menu): menu is SlotMenu => menu.type !== "CANCELED");
}
