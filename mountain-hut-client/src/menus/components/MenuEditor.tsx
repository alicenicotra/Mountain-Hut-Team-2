import { useState, type FormEvent } from "react";
import type { Dish, Menu } from "../types/menu.ts";
import Icon from "../../shared/components/Icon.tsx";
import { inputBase, primaryButton } from "../../shared/styles.ts";

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
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-green-100 text-green-800">
          <Icon name={menu ? "pencil" : "plus"} className="w-6 h-6" />
        </span>
        <div>
        <h2 className="text-xl font-semibold text-stone-900">{menu ? `Customize ${menu.name}` : "New menu"}</h2>
        <p className="mt-0.5 text-base text-stone-600">
          {menu ? "Create a custom copy. The original menu will remain unchanged." : "Choose a name and dishes for the new menu."}
        </p>
        </div>
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
          className={`mt-1 block w-full ${inputBase}`}
          placeholder="e.g. Vegetarian with tomini"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <Icon name="tables" className="w-5 h-5 text-green-700" />
          Courses
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-sm font-medium text-stone-600">{courses.length}</span>
        </h3>
        <button type="button" onClick={onNewDish} className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-800 transition-colors hover:bg-green-50 cursor-pointer">
          + Define new dish
        </button>
      </div>
      <ol className="space-y-3">
        {courses.map((id, index) => {
          const dish = dishes.find((item) => item.id === id);
          return (
            <li key={index} className="flex items-start gap-3 rounded-xl p-1 transition-colors hover:bg-stone-50">
              <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold transition-colors ${dish ? "bg-linear-to-br from-green-600 to-green-800 text-white shadow-sm" : "bg-stone-100 text-stone-500"}`}>{index + 1}</span>
              <div className="min-w-0 flex-1">
                <select
                  aria-label={`Course ${index + 1}`}
                  value={id ?? ""}
                  onChange={(event) => setCourse(index, event.target.value)}
                  className={`w-full ${inputBase} cursor-pointer`}
                >
                  <option value="">— No dish —</option>
                  {dishes.filter((item) => item.id === id || !selected.includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.course.toLowerCase()})</option>
                  ))}
                </select>
                {dish?.description && <p className="mt-1 pl-1 text-sm text-stone-500">{dish.description}</p>}
              </div>
              {courses.length > MIN_COURSES && (
                <button
                  type="button"
                  aria-label={`Remove course ${index + 1}`}
                  onClick={() => setCourses((current) => current.filter((_, pos) => pos !== index))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  <Icon name="trash" className="w-4 h-4" />
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {courses.length < MAX_COURSES && (
        <button type="button" onClick={() => setCourses((current) => [...current, null])} className="w-full rounded-xl border-2 border-dashed border-stone-300 px-4 py-2.5 text-sm font-medium text-green-800 transition-colors hover:border-green-500 hover:bg-green-50 cursor-pointer">
          + Add course
        </button>
      )}
      <p className="flex items-start gap-2 text-sm text-amber-800">
        <Icon name="info" className="w-4 h-4 mt-0.5" />
        Course positions are for editing only: the current backend saves dish associations, not their order.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <span className="text-base text-stone-600"><span className="text-2xl font-semibold text-stone-900">{selected.length}</span> selected {selected.length === 1 ? "dish" : "dishes"}</span>
        <button type="submit" disabled={!valid || saving} className={primaryButton}>
          {saving ? "Saving…" : menu ? "Save as custom menu" : "Create menu"}
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          {error}
        </p>
      )}
    </form>
  );
}
