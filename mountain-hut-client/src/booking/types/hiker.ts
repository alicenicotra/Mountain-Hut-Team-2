// A hiker the staff can reserve for. Hikers created with "Just a name" (MH-07)
// have no surname and no email.
export interface HikerMatch {
  id: number;
  name: string;
  surname: string | null;
  email: string | null;
  phoneNumber: string | null;
}

// POST /api/v1/users body (staff only)
export type NewHiker =
  // "New account": a real account; the backend generates the password
  | { type: "TEMPORARY"; name: string; surname: string; email: string; phoneNumber: string }
  // "Just a name": cannot log in
  | { type: "THROWAWAY"; name: string; phoneNumber?: string };

export interface CreatedHiker extends HikerMatch {
  // Only for "New account": the staff tell it to the hiker, who changes it at the first login
  temporaryPassword?: string;
}
