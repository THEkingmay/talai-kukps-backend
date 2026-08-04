import db from "../../db/index.ts";
import { adminInvites } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { AdminInvite } from "../../db/types.ts";
import crypto from "crypto";

export async function getAll(): Promise<AdminInvite[]> {
    return db.select().from(adminInvites);
}

export async function invite(
    email: string,
    addedBy: string,
): Promise<AdminInvite> {
    const inviteCode = crypto.randomBytes(16).toString("hex");
    const [invite] = await db
        .insert(adminInvites)
        .values({ email, addedBy, inviteCode, status: "pending" })
        .returning();
    return invite;
}

export async function revoke(email: string): Promise<void> {
    await db.delete(adminInvites).where(eq(adminInvites.email, email));
}

export async function verify(
    email: string,
    inviteCode: string,
): Promise<boolean> {
    const invite = await db
        .select()
        .from(adminInvites)
        .where(eq(adminInvites.email, email));
    return invite.length > 0 && invite[0].inviteCode === inviteCode;
}
