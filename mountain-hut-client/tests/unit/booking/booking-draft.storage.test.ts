import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveBookingDraft,
  loadBookingDraft,
  clearBookingDraft,
  PENDING_BOOKING_KEY,
  type BookingDraft,
} from '../../../src/booking/storage/booking-draft.ts'

describe('booking-draft storage (MH-96)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves and loads a booking draft from localStorage', () => {
    const draft: BookingDraft = {
      date: '2026-12-01',
      partySize: 4,
      slotId: '10',
      hasRequirements: true,
      description: 'Gluten free bread needed',
    }

    saveBookingDraft(draft)

    const stored = JSON.parse(localStorage.getItem(PENDING_BOOKING_KEY) || '{}')
    expect(stored).toEqual(draft)

    const loaded = loadBookingDraft()
    expect(loaded).toEqual(draft)
  })

  it('clears the booking draft from localStorage', () => {
    saveBookingDraft({
      date: '2026-12-01',
      partySize: 2,
    })

    expect(loadBookingDraft()).not.toBeNull()
    clearBookingDraft()
    expect(loadBookingDraft()).toBeNull()
    expect(localStorage.getItem(PENDING_BOOKING_KEY)).toBeNull()
  })

  it('returns null when no draft exists or if stored data is corrupted', () => {
    expect(loadBookingDraft()).toBeNull()

    localStorage.setItem(PENDING_BOOKING_KEY, 'invalid-json{{{')
    expect(loadBookingDraft()).toBeNull()

    localStorage.setItem(PENDING_BOOKING_KEY, 'null')
    expect(loadBookingDraft()).toBeNull()

    localStorage.setItem(PENDING_BOOKING_KEY, '"a primitive string"')
    expect(loadBookingDraft()).toBeNull()
  })

  it('handles localStorage errors gracefully without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })

    expect(() => {
      saveBookingDraft({ date: '2026-12-01', partySize: 2 })
    }).not.toThrow()
  })
})
