import { useState, type FormEvent } from "react";
import { DISH_COURSES, type CreateDishRequest, type Dish, type DishCourse } from "../types/menu.ts";
import Icon from "../../shared/components/Icon.tsx";
import { inputBase, primaryButton } from "../../shared/styles.ts";

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
    <section aria-label="Define new dish" className="rounded-2xl border border-green-200 bg-green-50/40 p-6 shadow-sm animate-fade-up">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-green-100 text-green-800">
            <Icon name="plus" className="w-6 h-6" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Define new dish</h3>
            <p className="text-base text-stone-600">Add a dish to the list of available dishes.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close dish form" className="flex items-center justify-center w-9 h-9 rounded-full text-stone-600 transition-colors hover:bg-stone-100 cursor-pointer">
          <Icon name="close" className="w-5 h-5" />
        </button>
      </div>
      {!available && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <Icon name="info" className="w-5 h-5 shrink-0" />
          Preview only. Saving new dishes needs backend POST /dishes and ingredient storage; existing dishes are available for menu creation.
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Dish name
          <input required maxLength={100} aria-label="Dish name" value={name} onChange={(event) => setName(event.target.value)} className={`mt-1 block w-full ${inputBase}`} />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Course type
          <select aria-label="Course type" value={course} onChange={(event) => setCourse(event.target.value as DishCourse)} className={`mt-1 block w-full ${inputBase} cursor-pointer capitalize`}>
            {DISH_COURSES.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}
          </select>
        </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          Description (optional)
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={`mt-1 block w-full ${inputBase}`} />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Ingredients</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {choices.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-base text-stone-700 transition-colors hover:border-green-400 has-checked:border-green-500 has-checked:bg-green-50 has-checked:text-green-900">
                <input type="checkbox" checked={ingredients.includes(item)} onChange={() => toggleIngredient(item)} className="w-4 h-4 accent-green-700" />
                {item}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input aria-label="New ingredient" value={newIngredient} onChange={(event) => setNewIngredient(event.target.value)} placeholder="Add an ingredient" className={`min-w-0 flex-1 ${inputBase}`} />
            <button type="button" onClick={addIngredient} disabled={!newIngredient.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-base font-medium transition-colors hover:border-green-600 hover:text-green-700 disabled:opacity-40 cursor-pointer"><Icon name="plus" className="w-4 h-4" />Add</button>
          </div>
        </fieldset>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-base font-medium text-stone-700 transition-colors hover:bg-stone-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={!name.trim() || !available || saving} className={primaryButton}>
            {saving ? "Saving…" : "Save dish"}
          </button>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            <Icon name="warning" className="w-5 h-5" />
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
