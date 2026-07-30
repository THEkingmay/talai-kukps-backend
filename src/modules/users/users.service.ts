import db from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { User } from "../../db/types.ts";

export async function getAll(): Promise<User[]> {
    return db.select().from(users);
}

export async function getById(id: string): Promise<User | null> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
    return user ?? null;
}
