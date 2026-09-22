import db from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { User } from "../../db/types.ts";
import {
  NotFoundError,
  BadRequestError,
} from "../../middlewares/error.middleware.ts";

export async function getAll(): Promise<User[]> {
  return db.select().from(users);
}

export async function getById(id: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  // ลบโดยการเปลี่ยน deletedAt เป็น timestamp ปัจจุบัน
  const exitingUser = await getById(id);
  if (!exitingUser) throw new NotFoundError("User not found");

  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
}

export async function restoreDeletedUser(id: string): Promise<void> {
  await db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
}
