import { useState, type FormEvent } from "react";
import type { Dish, Menu } from "../types/menu.ts";

const MIN_COURSES = 6;
const MAX_COURSES = 12;

function initialCourses(menu: Menu | null): (number | null)[] {
  const ids = menu?.dishes.map((dish) => dish.id) ?? [];
  return Array.from({ length: Math.max(MIN_COURSES, ids.length) }, (_, index) => ids[index] ?? null);
}

interface MenuEditorProps {
  menu: Menu | null;
  dishes: Dish[];
  onSave: (name: string, dishIds: number[]) => Promise<void>;
  onNewDish: () => void;
}

export default function MenuEditor({ menu, dishes, onSave, onNewDish }: MenuEditorProps) {
  // A modified menu is always saved as a new menu: templates are never overwritten.
  const [name, setName] = useState(menu ? `${menu.name} (custom)` : "");
  const [courses, setCourses] = useState<(number | null)[]>(() => initialCourses(menu));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = courses.filter((id): id is number => id !== null);
  const valid = name.trim().length > 0 && selected.length > 0 &&
    new Set(selected).size === selected.length;

  function setCourse(index: number, value: string) {
    const nextId = value === "" ? null : Number(value);
    setCourses((current) => current.map((id, position) => position === index ? nextId : id));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save menu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">{menu ? `Customize ${menu.name}` : "New menu"}</h2>
        <p className="mt-1 text-sm text-stone-600">
          {menu ? "Create a custom copy. The original menu will remain unchanged." : "Choose a name and dishes for the new menu."}
        </p>
      </div>

      <label className="block text-sm font-medium text-stone-700">
        Menu name
        <input
          aria-label="Menu name"
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(event) => { setName(event.target.value); setError(null); }}
          className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
          placeholder="e.g. Vegetarian with tomini"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Courses</h3>
        <button type="button" onClick={onNewDish} className="rounded border border-green-700 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50">
          + Define new dish
        </button>
      </div>
      <ol className="space-y-3">
        {courses.map((id, index) => {
          const dish = dishes.find((item) => item.id === id);
          return (
            <li key={index} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 font-semibold text-stone-700">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <select
                  aria-label={`Course ${index + 1}`}
                  value={id ?? ""}
                  onChange={(event) => setCourse(index, event.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-800"
                >
                  <option value="">— No dish —</option>
                  {dishes.filter((item) => item.id === id || !selected.includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.course.toLowerCase()})</option>
                  ))}
                </select>
                {dish?.description && <p className="mt-1 text-xs text-stone-500">{dish.description}</p>}
              </div>
              {courses.length > MIN_COURSES && (
                <button
                  type="button"
                  aria-label={`Remove course ${index + 1}`}
                  onClick={() => setCourses((current) => current.filter((_, pos) => pos !== index))}
                  className="rounded px-2 py-2 text-sm text-stone-500 hover:bg-stone-100"
                >Remove</button>
              )}
            </li>
          );
        })}
      </ol>
      {courses.length < MAX_COURSES && (
        <button type="button" onClick={() => setCourses((current) => [...current, null])} className="text-sm font-medium text-green-800 hover:underline">
          + Add course
        </button>
      )}
      <p className="text-xs text-amber-800">
        Course positions are for editing only: the current backend saves dish associations, not their order.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <span className="text-sm text-stone-600">{selected.length} selected {selected.length === 1 ? "dish" : "dishes"}</span>
        <button type="submit" disabled={!valid || saving} className="rounded-lg bg-green-700 px-5 py-2.5 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-stone-300">
          {saving ? "Saving…" : menu ? "Save as custom menu" : "Create menu"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
