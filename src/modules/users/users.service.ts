import db from "../../db/index.ts";
import { users , adminInvites } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { User } from "../../db/types.ts";
import { NotFoundError , BadRequestError } from "../../middlewares/error.middleware.ts";

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

export async function deleteUser(id: string): Promise<void> {
    // ลบแบบ email anonymization เพื่อไม่ให้กรทบ fk
    // 1.เปลีย่น email เป็ฯ deleted_<timestamp>_<original_email>
    // 2.เปลี่ยนสถานะในตาราง users เป็น deleted
    // 3.ลบในตาราง admin_invite เพื่อจะได้ชวนใหม่ได้ (ถ้าเป็นแอดมิน)
    const exitingUser = await getById(id);
    if (!exitingUser) throw new NotFoundError("User not found");

    const newEmail = `deleted_${Date.now()}_${exitingUser.email}`;
    await db.update(users)
        .set({ email: newEmail , status: 'deleted'})
        .where(eq(users.id, id));

    if (exitingUser.role === 'admin') {
        await db.delete(adminInvites)
            .where(eq(adminInvites.email, exitingUser.email));
    }
}

export async function updateUserStatus(id: string, status: "active" | "suspended"): Promise<void> {
    await db.update(users)
        .set({ status })
        .where(eq(users.id, id));
}
