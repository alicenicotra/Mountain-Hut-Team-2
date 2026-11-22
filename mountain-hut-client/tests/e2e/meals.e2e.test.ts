import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

// MH-136 — E2E tests for MH-11: view meal times, menus, dishes and allergens.
// Unlike unit tests, the happy paths use the real /api/v1 routes and database.
// Requires MH-133 + MH-134 + MH-114/115 to be integrated before execution.

const HUT_TIME_ZONE = 'Europe/Rome'
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }

test.use({ timezoneId: HUT_TIME_ZONE })

type Dish = {
  id: number
  name: string
  description: string | null
  course: 'APPETIZER' | 'MAIN' | 'SIDE' | 'DESSERT' | 'BEVERAGE'
}

type Allergen = { id: number; name: string }

type Meal = {
  slotId: number
  date: string
  from: string
  to: string
  menus: { id: number; name: string; allergens: Allergen[] }[]
}

function todayAtHut(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: HUT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function addDays(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

// Avoid the demo seed and other E2E tests; each test uses a different future day.
function unusedDay(): string {
  return addDays(todayAtHut(), 365 + Math.floor(Math.random() * 20000))
}

async function signInEmployee(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', { data: EMPLOYEE })
  expect(response.status(), 'employee seed account must exist').toBe(200)
}

async function signOut(page: Page) {
  const response = await page.request.post('/api/v1/auth/logout')
  expect(response.status()).toBe(200)
}

async function getDish(page: Page, name: string): Promise<Dish> {
  const response = await page.request.get('/api/v1/dishes')
  expect(response.status(), 'dishes API must be available').toBe(200)
  const dishes = (await response.json()) as Dish[]
  const found = dishes.find((dish) => dish.name === name)
  expect(found, `seed dish ${name} must exist`).toBeDefined()
  return found!
}

async function createMenu(page: Page, name: string, dishIds: number[]): Promise<number> {
  const response = await page.request.post('/api/v1/menus', {
    data: { name, type: 'TEMPLATE', dishes: dishIds },
  })
  expect(response.status(), `could not create menu ${name}: ${await response.text()}`).toBe(201)
  return ((await response.json()) as { id: number }).id
}

async function createSlot(page: Page, date: string, from: string, to: string, menuIds: number[]) {
  const response = await page.request.post('/api/v1/slots', {
    data: { date, from, to, tableIds: [], menuIds },
  })
  expect(response.status(), `could not create slot ${from}–${to}: ${await response.text()}`).toBe(201)
}

async function selectDay(page: Page, day: string) {
  await page.getByLabel('Other day').fill(day)
  await expect(page.getByLabel('Other day')).toHaveValue(day)
  await expect(page.getByLabel('Loading meals')).toHaveCount(0)
}

async function openAsGuest(page: Page) {
  await signOut(page)
  await page.goto('/meals')
  await expect(page).toHaveURL(/\/meals$/)
  await expect(page.getByRole('heading', { name: 'Meal times & menus' })).toBeVisible()
}

test.describe('MH-136 — view meal details (real API and browser)', () => {
  test('a guest sees meal times, staff-defined menus, dishes, descriptions and allergens', async ({ page }) => {
    const date = unusedDay()
    const suffix = randomUUID().slice(0, 8)
    const conflictingName = `MH136 Alpino ${suffix}`
    const safeName = `MH136 Leggero ${suffix}`

    await signInEmployee(page)
    const tagliere = await getDish(page, 'Tagliere del Rifugio')
    const patate = await getDish(page, 'Patate al Forno con Rosmarino')
    const conflictingId = await createMenu(page, conflictingName, [tagliere.id])
    const safeId = await createMenu(page, safeName, [patate.id])
    await createSlot(page, date, '12:00', '14:00', [conflictingId, safeId])
    await createSlot(page, date, '19:00', '21:00', [])

    // The API really exposes the staff-defined menus publicly, without a session.
    await signOut(page)
    const response = await page.request.get(`/api/v1/meals?date=${date}`)
    expect(response.status()).toBe(200)
    const meals = (await response.json()) as Meal[]
    expect(meals.map((meal) => meal.from)).toEqual(['12:00', '19:00'])
    expect(meals[0].menus.map((menu) => menu.name)).toEqual([conflictingName, safeName])
    expect(meals[0].menus[0].allergens.map((a) => a.name)).toEqual(['Milk', 'Wheat'])

    await page.goto('/meals')
    await selectDay(page, date)
    await expect(page.getByText('2 meal times')).toBeVisible()

    const lunch = page.getByRole('region', { name: 'Meal 12:00–14:00' })
    await expect(lunch.getByRole('heading', { name: 'Lunch' })).toBeVisible()
    const alpino = lunch.getByRole('article', { name: conflictingName })
    const leggero = lunch.getByRole('article', { name: safeName })
    await expect(alpino).toBeVisible()
    await expect(leggero).toBeVisible()
    await expect(alpino.getByText(tagliere.name)).toBeVisible()
    if (tagliere.description) await expect(alpino.getByText(tagliere.description)).toBeVisible()
    await expect(alpino.getByText('Appetizers')).toBeVisible()
    await expect(alpino.getByText('Milk', { exact: true }).first()).toBeVisible()
    await expect(alpino.getByText('Wheat', { exact: true }).first()).toBeVisible()
    await expect(leggero.getByText(patate.name)).toBeVisible()
    await expect(leggero.getByText('No listed allergens')).toBeVisible()

    const dinner = page.getByRole('region', { name: 'Meal 19:00–21:00' })
    await expect(dinner.getByRole('heading', { name: 'Dinner' })).toBeVisible()
    await expect(dinner.getByText("The menu for this meal time hasn't been announced yet.")).toBeVisible()
  })

  test('allergen preferences mark unsuitable menus, rank suitable ones first, and can be cleared', async ({ page }) => {
    const date = unusedDay()
    const suffix = randomUUID().slice(0, 8)
    const conflictingName = `MH136 A Milk ${suffix}`
    const safeName = `MH136 Z Safe ${suffix}`

    await signInEmployee(page)
    const tagliere = await getDish(page, 'Tagliere del Rifugio')
    const patate = await getDish(page, 'Patate al Forno con Rosmarino')
    const conflictingId = await createMenu(page, conflictingName, [tagliere.id])
    const safeId = await createMenu(page, safeName, [patate.id])
    await createSlot(page, date, '12:00', '14:00', [conflictingId, safeId])

    await openAsGuest(page)
    await selectDay(page, date)
    const lunch = page.getByRole('region', { name: 'Meal 12:00–14:00' })
    const filter = page.getByRole('group', { name: 'Allergens to avoid' })
    const milk = filter.getByRole('button', { name: 'Milk' })
    await expect(milk).toBeVisible()
    await milk.click()
    await expect(milk).toHaveAttribute('aria-pressed', 'true')

    await expect(lunch.getByText('1 of 2 menus suit your party')).toBeVisible()
    await expect(lunch.getByRole('article', { name: conflictingName }).getByText('Contains Milk')).toBeVisible()
    await expect(lunch.getByRole('article', { name: safeName }).getByText('✓ Suits your party')).toBeVisible()
    await expect(lunch.getByRole('article').first()).toHaveAttribute('aria-label', safeName)
    // Filtering marks unsuitable food, rather than hiding it completely.
    await expect(lunch.getByRole('article', { name: conflictingName })).toBeVisible()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(milk).toHaveAttribute('aria-pressed', 'false')
    await expect(lunch.getByText('Contains Milk')).toHaveCount(0)
    await expect(lunch.getByText('✓ Suits your party')).toHaveCount(0)
  })

  test('changing the selected date loads only the meals for that date', async ({ page }) => {
    const date = unusedDay()
    const following = addDays(date, 1)
    const menuName = `MH136 Date ${randomUUID().slice(0, 8)}`

    await signInEmployee(page)
    const patate = await getDish(page, 'Patate al Forno con Rosmarino')
    const menuId = await createMenu(page, menuName, [patate.id])
    await createSlot(page, date, '12:00', '14:00', [menuId])
    await createSlot(page, following, '19:00', '21:00', [menuId])

    await openAsGuest(page)
    await expect(page.getByRole('group', { name: 'Day' }).getByRole('button')).toHaveCount(7)
    await selectDay(page, date)
    await expect(page.getByRole('region', { name: 'Meal 12:00–14:00' })).toBeVisible()
    await selectDay(page, following)
    await expect(page.getByRole('region', { name: 'Meal 19:00–21:00' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Meal 12:00–14:00' })).toHaveCount(0)
    await selectDay(page, date)
    await expect(page.getByRole('region', { name: 'Meal 12:00–14:00' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Meal 19:00–21:00' })).toHaveCount(0)
  })

  test('a day without slots displays the empty state', async ({ page }) => {
    await page.goto('/meals')
    await selectDay(page, unusedDay())
    await expect(page.getByText('No meal times on this day.')).toBeVisible()
    await expect(page.getByRole('region', { name: /^Meal \d{2}:\d{2}/ })).toHaveCount(0)
  })

  test('a canceled menu disappears from the guest view but its slot remains', async ({ page }) => {
    const date = unusedDay()
    const menuName = `MH136 Cancel ${randomUUID().slice(0, 8)}`

    await signInEmployee(page)
    const patate = await getDish(page, 'Patate al Forno con Rosmarino')
    const menuId = await createMenu(page, menuName, [patate.id])
    await createSlot(page, date, '19:00', '21:00', [menuId])
    const response = await page.request.delete(`/api/v1/menus/${menuId}`)
    expect(response.status()).toBe(204)

    await openAsGuest(page)
    await selectDay(page, date)
    const dinner = page.getByRole('region', { name: 'Meal 19:00–21:00' })
    await expect(dinner).toBeVisible()
    await expect(dinner.getByRole('article', { name: menuName })).toHaveCount(0)
    await expect(dinner.getByText("The menu for this meal time hasn't been announced yet.")).toBeVisible()
  })

  test('the page displays an API error instead of stale meal data', async ({ page }) => {
    // The only stub in this suite: a deterministic server failure, to exercise UX.
    await page.route('**/api/v1/meals?date=*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Meal service temporarily unavailable' }),
      })
    })
    await page.goto('/meals')
    await expect(page.getByRole('alert')).toContainText(
      'Could not load the meals: Meal service temporarily unavailable',
    )
    await expect(page.getByRole('region', { name: /^Meal \d{2}:\d{2}/ })).toHaveCount(0)
  })
})
