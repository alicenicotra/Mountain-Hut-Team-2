import { z } from "zod";

//
// QUERY
//
export const getUserQuerySchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  surname: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

//
// CREATION
//
const contactFields = z.object({
  email: z.email("Invalid email format").trim(),
  name: z.string().min(1, "Name is required").trim(),
  surname: z.string().min(1, "Surname is required").trim(),
  phoneNumber: z.string().min(1, "Phone number is required").trim(),
});

export const standardUserCreationSchema = contactFields.extend({
  password: z.string().min(8, "Password must be at least 8 characters long"),
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER"]),
});

export const temporaryUserCreationSchema = contactFields.extend({
  type: z.literal("TEMPORARY"),
});

export const throwawayUserCreationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(1).nullable().optional(),
  type: z.literal("THROWAWAY"),
});

export const userCreationSchema = z.discriminatedUnion("type", [
  standardUserCreationSchema,
  temporaryUserCreationSchema,
  throwawayUserCreationSchema,
]);

export type UserCreation = z.infer<typeof userCreationSchema>;

//
// RESPONSE
//
const baseUser = {
  id: z.number(),
  name: z.string(),
  phoneNumber: z.string().nullable(),
};

const standardUserSchema = z.object({
  ...baseUser,
  email: z.string(),
  surname: z.string(),
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER", "TEMPORARY"]),
  temporaryPassword: z.string().optional(),
});

const throwawayUserSchema = z.object({
  ...baseUser,
  email: z.string().nullable(),
  surname: z.string().nullable(),
  type: z.literal("THROWAWAY"),
});

export const userResponseSchema = z.discriminatedUnion("type", [
  standardUserSchema,
  throwawayUserSchema,
]);

export type UserResponse = z.infer<typeof userResponseSchema>;
