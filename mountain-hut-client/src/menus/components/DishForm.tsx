import { useState, type FormEvent } from "react";
import { DISH_COURSES, type CreateDishRequest, type Dish, type DishCourse } from "../types/menu.ts";

interface DishFormProps {
  available: boolean;
  onCreate: (dish: CreateDishRequest) => Promise<Dish>;
  onClose: () => void;
}

const INGREDIENT_SUGGESTIONS = [
  "Cheese", "Eggs", "Flour", "Milk", "Mushrooms", "Nuts", "Potato", "Tomato",
];

export default function DishForm({ available, onCreate, onClose }: DishFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [course, setCourse] = useState<DishCourse>("MAIN");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [choices, setChoices] = useState(INGREDIENT_SUGGESTIONS);
  const [newIngredient, setNewIngredient] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleIngredient(value: string) {
    setIngredients((current) => current.includes(value)
      ? current.filter((ingredient) => ingredient !== value)
      : [...current, value]);
  }

  function addIngredient() {
    const ingredient = newIngredient.trim();
    if (!ingredient) return;
    const existing = choices.find((value) => value.toLowerCase() === ingredient.toLowerCase());
    if (existing) {
      setIngredients((current) => current.includes(existing) ? current : [...current, existing]);
    } else {
      setChoices((current) => [...current, ingredient]);
      setIngredients((current) => [...current, ingredient]);
    }
    setNewIngredient("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !available || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null, course, ingredients });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save dish");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Define new dish" className="rounded-xl border border-green-200 bg-green-50/40 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Define new dish</h3>
          <p className="text-sm text-stone-600">Add a dish to the list of available dishes.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close dish form" className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100">✕</button>
      </div>
      {!available && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Preview only. Saving new dishes needs backend POST /dishes and ingredient storage; existing dishes are available for menu creation.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-stone-700">
          Dish name
          <input required maxLength={100} aria-label="Dish name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Course type
          <select aria-label="Course type" value={course} onChange={(event) => setCourse(event.target.value as DishCourse)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2">
            {DISH_COURSES.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Description (optional)
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Ingredients</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {choices.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={ingredients.includes(item)} onChange={() => toggleIngredient(item)} className="accent-green-700" />
                {item}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input aria-label="New ingredient" value={newIngredient} onChange={(event) => setNewIngredient(event.target.value)} placeholder="Add an ingredient" className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" />
            <button type="button" onClick={addIngredient} disabled={!newIngredient.trim()} className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-40">Add</button>
          </div>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-white">Cancel</button>
          <button type="submit" disabled={!name.trim() || !available || saving} className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:bg-stone-300">
            {saving ? "Saving…" : "Save dish"}
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}
