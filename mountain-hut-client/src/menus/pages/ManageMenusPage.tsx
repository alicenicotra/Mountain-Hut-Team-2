import { useEffect, useState } from "react";
import { createDish, createMenu, getDishes, getMenus, isMenuMockMode } from "../api/menus-api.ts";
import DishForm from "../components/DishForm.tsx";
import MenuEditor from "../components/MenuEditor.tsx";
import type { CreateDishRequest, Dish, Menu } from "../types/menu.ts";

const card = "rounded-xl border border-stone-200 bg-white p-5 shadow-sm";

export default function ManageMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedId, setSelectedId] = useState<number | null | undefined>(undefined);
  const [newMenuRevision, setNewMenuRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDishForm, setShowDishForm] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getMenus(), getDishes()])
      .then(([loadedMenus, loadedDishes]) => {
        if (!active) return;
        setMenus(loadedMenus);
        setDishes(loadedDishes);
        setSelectedId((previous) => previous === undefined ? (loadedMenus[0]?.id ?? null) : previous);
        setLoadError(null);
      })
      .catch((err: Error) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const selectedMenu = menus.find((menu) => menu.id === selectedId) ?? null;
  const templates = menus.filter((menu) => menu.type === "TEMPLATE");
  const custom = menus.filter((menu) => menu.type === "MODIFIED");

  function pickMenu(id: number | null) {
    setSelectedId(id);
    setNotice(null);
    setShowDishForm(false);
    if (id === null) setNewMenuRevision((value) => value + 1);
  }

  async function saveMenu(name: string, dishIds: number[]) {
    const { id } = await createMenu({ name, type: "MODIFIED", dishes: dishIds });
    const updated = await getMenus();
    setMenus(updated);
    setSelectedId(id);
    setNotice(`Custom menu "${name}" created.`);
    setShowDishForm(false);
  }

  async function saveDish(input: CreateDishRequest): Promise<Dish> {
    const dish = await createDish(input);
    setDishes((current) => [...current, dish]);
    setShowDishForm(false);
    setNotice(`Dish "${dish.name}" added. You can now select it in a course.`);
    return dish;
  }

  return (
    <div className="relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manage menus</h1>
        <p className="mt-1 text-stone-600">Browse default menus and create custom versions using available dishes.</p>
      </div>
      {isMenuMockMode && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
          Demo mode: menu and dish changes are kept in memory and will reset when the page reloads.
        </p>
      )}
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{notice}</p>}
      {loading ? (
        <p role="status" className={card}>Loading menus…</p>
      ) : loadError ? (
        <div role="alert" className={`${card} space-y-3`}>
          <p className="text-red-700">Could not load menus: {loadError}</p>
          <button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="rounded bg-green-700 px-4 py-2 text-white">Retry</button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
          <aside className={`${card} space-y-5`} aria-label="Menu selection">
            <section aria-label="Default menus">
              <h2 className="mb-3 text-lg font-semibold">Default menus</h2>
              <div className="space-y-2">
                {templates.length === 0 && <p className="text-sm text-stone-500">No default menus yet</p>}
                {templates.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    aria-pressed={selectedId === menu.id}
                    onClick={() => pickMenu(menu.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${selectedId === menu.id ? "border-green-700 bg-green-50 text-green-900" : "border-stone-300 bg-white text-stone-800 hover:border-green-500"}`}
                  >{menu.name}</button>
                ))}
              </div>
            </section>
            <div className="border-t border-stone-200" />
            <section aria-label="Custom menus">
              <h2 className="mb-3 text-lg font-semibold">Custom menus</h2>
              <div className="space-y-2">
                {custom.length === 0 && <p className="text-sm text-stone-500">No custom menus yet</p>}
                {custom.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    aria-pressed={selectedId === menu.id}
                    onClick={() => pickMenu(menu.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${selectedId === menu.id ? "border-green-700 bg-green-50 text-green-900" : "border-stone-300 bg-white text-stone-800 hover:border-green-500"}`}
                  >{menu.name}</button>
                ))}
              </div>
            </section>
            <button type="button" onClick={() => pickMenu(null)} className="w-full rounded-lg border border-green-700 bg-green-700 px-4 py-2.5 font-medium text-white hover:bg-green-800">
              + New menu
            </button>
          </aside>
          <div className="space-y-5">
            <section className={card} aria-label="Menu editor">
              <MenuEditor
                key={selectedMenu ? `menu-${selectedMenu.id}` : `new-${newMenuRevision}`}
                menu={selectedMenu}
                dishes={dishes}
                onSave={saveMenu}
                onNewDish={() => { setShowDishForm(true); setNotice(null); }}
              />
            </section>
            {showDishForm && (
              <DishForm available={isMenuMockMode} onCreate={saveDish} onClose={() => setShowDishForm(false)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
