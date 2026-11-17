export interface BookingDraft {
  date: string;
  partySize: number;
  slotId?: string;
  hasRequirements?: boolean;
  description?: string;
}

export const PENDING_BOOKING_KEY = "mountain_hut_pending_booking";

export function saveBookingDraft(draft: BookingDraft): void {
  try {
    localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage quota or access errors in restricted environments
  }
}

export function loadBookingDraft(): BookingDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BookingDraft;
  } catch {
    return null;
  }
}

export function clearBookingDraft(): void {
  try {
    localStorage.removeItem(PENDING_BOOKING_KEY);
  } catch {
    // Ignore storage errors
  }
}
