import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHiker, searchHikers } from '../../../src/booking/api/hikers-api.ts'

const mario = {
  id: 1,
  name: 'Mario',
  surname: 'Rossi',
  email: 'mario.rossi@example.com',
  phoneNumber: '+393331234567',
  type: 'HIKER',
}
const luca = { ...mario, id: 2, name: 'Luca', email: 'luca.rossi@example.com', type: 'EMPLOYEE' }

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

// Answers each request with what `users` returns for its query string
function stubApi(users: (query: URLSearchParams) => unknown[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const found = users(new URL(url, 'http://localhost').searchParams)
    return found.length > 0
      ? response(200, found)
      : response(404, { message: 'User Not Found' })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const queriesSent = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.map(([url]) => {
    const parsed = new URL(url, 'http://localhost')
    return `${parsed.pathname}${parsed.search}`
  })

// MH-07: a hiker can be matched by name, phone or email
describe('searchHikers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['an email', 'mario.rossi@example.com', ['/api/v1/users?email=mario.rossi%40example.com']],
    ['a phone number', '+39 333 1234567', ['/api/v1/users?phoneNumber=%2B393331234567']],
    ['a phone number without prefix', '3331234567', ['/api/v1/users?phoneNumber=3331234567']],
    ['one word, as name and as surname', 'rossi', [
      '/api/v1/users?name=rossi',
      '/api/v1/users?surname=rossi',
    ]],
    ['two words, in both orders', '  mario  rossi ', [
      '/api/v1/users?name=mario&surname=rossi',
      '/api/v1/users?name=rossi&surname=mario',
    ]],
    ['a surname of more words', 'mario de luca', [
      '/api/v1/users?name=mario&surname=de+luca',
      '/api/v1/users?name=de+luca&surname=mario',
    ]],
  ])('asks the API for %s', async (_label, text, expected) => {
    const fetchMock = stubApi(() => [])

    await searchHikers(text)

    expect(queriesSent(fetchMock)).toEqual(expected)
  })

  it('returns who the API finds', async () => {
    stubApi((query) => (query.get('surname') === 'rossi' ? [mario] : []))

    expect(await searchHikers('rossi')).toEqual([mario])
  })

  it('finds nobody when the API answers 404 to every query', async () => {
    stubApi(() => [])

    expect(await searchHikers('nobody')).toEqual([])
  })

  it('lists a person once, even when more queries find them', async () => {
    stubApi(() => [mario])

    expect(await searchHikers('rossi')).toEqual([mario])
  })

  it('does not list employees', async () => {
    stubApi(() => [mario, luca])

    expect(await searchHikers('rossi')).toEqual([mario])
  })

  // MH-07: hikers created at the hut can come back and book again
  it('lists the hikers created by the staff, with or without an account', async () => {
    const anna = { ...mario, id: 3, name: 'Anna', type: 'TEMPORARY' }
    const luigi = { id: 4, name: 'Luigi', surname: null, email: null, phoneNumber: null, type: 'THROWAWAY' }
    stubApi(() => [mario, luca, anna, luigi])

    expect(await searchHikers('rossi')).toEqual([mario, anna, luigi])
  })

  it.each([
    [401, 'Authentication required'],
    [403, 'Only employees and managers can search users'],
    [500, 'Internal server error'],
  ])('reports a %i from the API', async (status, error) => {
    vi.stubGlobal('fetch', vi.fn(async () => response(status, { error })))

    await expect(searchHikers('rossi')).rejects.toThrow(error)
  })
})

describe('createHiker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the new hiker to POST /users and returns what the API created', async () => {
    const created = { id: 20, name: 'Anna', surname: 'Bianchi', email: 'anna@example.com', phoneNumber: '+39 333', type: 'TEMPORARY', temporaryPassword: 'secret' }
    const fetchMock = vi.fn(async () => response(201, created))
    vi.stubGlobal('fetch', fetchMock)
    const body = { type: 'TEMPORARY' as const, name: 'Anna', surname: 'Bianchi', email: 'anna@example.com', phoneNumber: '+39 333' }

    expect(await createHiker(body)).toEqual(created)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }))
  })

  it('reports the status of a refused creation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(409, { message: 'An account with this email already exists' })))

    await expect(createHiker({ type: 'THROWAWAY', name: 'Luigi' })).rejects.toMatchObject({ status: 409 })
  })
})
