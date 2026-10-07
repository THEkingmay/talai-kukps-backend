import db from "../../db/index.ts";
import { adminInvites } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { AdminInvite } from "../../db/types.ts";
import crypto from "crypto";
import {
  BadRequestError,
  NotFoundError,
} from "../../middlewares/error.middleware.ts";
import emailService from "../../services/email.service.ts";
import redisService from "../../services/redis.service.ts";
import { redisKeys } from "../../services/redis-keys.ts";

export async function getAll(): Promise<AdminInvite[]> {
  return db.select().from(adminInvites).orderBy(adminInvites.createdAt);
}

export async function invite(
  email: string,
  addedBy: string,
  role: "superadmin" | "admin" | "driver",
): Promise<AdminInvite> {
  const inviteCode = crypto.randomBytes(16).toString("hex");
  const [invite] = await db
    .insert(adminInvites)
    .values({ email, addedBy, status: "pending", role })
    .returning();

  await redisService.hSet(redisKeys.invite(email), { inviteCode });

  await emailService.sendAdminInviteEmail(email, inviteCode, role);
  return invite;
}

export async function revoke(email: string): Promise<void> {
  const existingInvite = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.email, email));
  if (!existingInvite || existingInvite.length === 0) {
    throw new NotFoundError("ไม่พบรายการคำเชิญนี้ในระบบ");
  }
  // ถ้าสถานไม่ใช้ pending ลบไม่ได้
  if (existingInvite[0].status !== "pending") {
    throw new BadRequestError(
      "ไม่สามารถยกเลิกคำเชิญที่ไม่ได้อยู่ในสถานะรอยืนยันได้",
    );
  }
  await redisService.delete(redisKeys.invite(email));
  await db.delete(adminInvites).where(eq(adminInvites.email, email));
}
