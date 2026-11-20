import { eq, inArray, type InferSelectModel } from "drizzle-orm";

import { db } from "#src/db/database";
import {
  menusTable,
  menuDishesTable,
  dishesTable,
  type MenuType,
} from "#src/db/schema";
import type { Dish } from "#src/menus/dishes/dish-repository";

export type Menu = InferSelectModel<typeof menusTable>;

export interface MenuWithDishes extends Menu {
  dishes: Dish[];
}

export class MenuRepository {
  static async getMenus(type?: MenuType): Promise<MenuWithDishes[]> {
    const menus = await db
      .select()
      .from(menusTable)
      .where(type ? eq(menusTable.type, type) : undefined);

    if (menus.length === 0) {
      return [];
    }

    const menuIds = menus.map((m) => m.id);

    const menuDishRows = await db
      .select({
        menuId: menuDishesTable.menuId,
        dish: dishesTable,
      })
      .from(menuDishesTable)
      .innerJoin(dishesTable, eq(menuDishesTable.dishId, dishesTable.id))
      .where(inArray(menuDishesTable.menuId, menuIds));

    const dishesByMenuId = new Map<number, Dish[]>();
    for (const menu of menus) {
      dishesByMenuId.set(menu.id, []);
    }

    for (const row of menuDishRows) {
      dishesByMenuId.get(row.menuId)?.push(row.dish);
    }

    return menus.map((menu) => ({
      ...menu,
      dishes: dishesByMenuId.get(menu.id) ?? [],
    }));
  }

  static async createMenu(
    name: string,
    type: MenuType,
    dishIds: number[],
  ): Promise<number> {
    return await db.transaction(async (tx) => {
      const [insertedMenu] = await tx
        .insert(menusTable)
        .values({
          name,
          type,
        })
        .returning({ id: menusTable.id });

      if (dishIds.length > 0) {
        await tx.insert(menuDishesTable).values(
          dishIds.map((dishId) => ({
            menuId: insertedMenu.id,
            dishId,
          })),
        );
      }

      return insertedMenu.id;
    });
  }

  static async cancelMenu(id: number): Promise<boolean> {
    const result = await db
      .update(menusTable)
      .set({ type: "CANCELED" })
      .where(eq(menusTable.id, id))
      .returning({ id: menusTable.id });

    return result.length > 0;
  }
}
