import { z } from "zod";

//
// REGISTRATION SCHEMAS
//
const standardRegisterSchema = z.object({
  type: z.enum(["HIKER", "EMPLOYEE", "MANAGER"]).default("HIKER"),
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

const temporaryRegisterSchema = z.object({
  type: z.literal("TEMPORARY"),
  email: z.email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nullish()
    .default(null),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

const throwawayRegisterSchema = z.object({
  type: z.literal("THROWAWAY"),
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format").nullish().default(null),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nullish()
    .default(null),
  surname: z.string().min(1).nullish().default(null),
  phoneNumber: z.string().min(1).nullish().default(null),
});

export const registerSchema = z.discriminatedUnion("type", [
  standardRegisterSchema,
  temporaryRegisterSchema,
  throwawayRegisterSchema,
]);

export type RegisterInput = z.infer<typeof registerSchema>;

//
// LOGIN SCHEMAS
//
export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
