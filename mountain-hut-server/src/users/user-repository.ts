import { db } from "../db/database.ts";
import { eq, and, SQL, type InferSelectModel, sql } from "drizzle-orm";
import { usersTable, type UserType } from "../db/schema.ts";

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
  surname: string;
  phoneNumber?: string;
  type: UserType;
}

export type User = InferSelectModel<typeof usersTable>;

export class UserRepository {
  static async getUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(sql`LOWER(${usersTable.email})`, cleanEmail))
      .limit(1);
    return user ?? null;
  }

  static async getUserById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return user ?? null;
  }

  static async getUsersByName(
    name: string = "",
    surname: string = "",
  ): Promise<User[] | null> {
    const cleanName = name.trim().toLowerCase();
    const cleanSurname = surname.trim().toLowerCase();

    const conditions: SQL[] = [
      ...(cleanName ? [eq(sql`LOWER(${usersTable.name})`, cleanName)] : []),
      ...(cleanSurname
        ? [eq(sql`LOWER(${usersTable.surname})`, cleanSurname)]
        : []),
    ];

    if (conditions.length === 0) {
      return null;
    }

    return db
      .select()
      .from(usersTable)
      .where(and(...conditions));
  }

  static async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phoneNumber, phoneNumber))
      .limit(1);
    return user ?? null;
  }

  static async createUser(data: CreateUserData): Promise<User> {
    const [newUser] = await db.insert(usersTable).values(data).returning();
    return newUser;
  }

  static async updatePasswordHash(
    userId: number,
    passwordHash: string,
  ): Promise<void> {
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, userId));
  }
}
