import db from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { User } from "../../db/types.ts";
import {
  NotFoundError,
  BadRequestError,
} from "../../middlewares/error.middleware.ts";
import s3Service from "../../services/s3.service.ts";

export async function getAll(): Promise<Omit<User, "hashPassword">[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      phoneNumber: users.phoneNumber,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users);
}

export async function getById(
  id: string,
): Promise<Omit<User, "hashPassword"> | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      phoneNumber: users.phoneNumber,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
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

export async function updateProfile(
  userId: string,
  firstName: string | undefined,
  lastName: string | undefined,
  profileImage: Express.Multer.File | undefined,
  phoneNumber: string | undefined,
): Promise<User | undefined> {
  // สร้าง Object เพื่อรวบรวมข้อมูลที่จะอัปเดตทั้งหมดไว้ก้อนเดียว
  const updateData: Partial<typeof users.$inferInsert> = {};

  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

  // อัปโหลดรูปภาพให้เสร็จก่อน (ถ้ามี)
  if (profileImage) {
    const fileName = `${userId}-profile-${Date.now()}.jpg`;

    await s3Service.uploadFile(profileImage, "kukps-talai-avatar", fileName);
    updateData.profileImageUrl = s3Service.getPublicUrl(
      "kukps-talai-avatar",
      fileName,
    );
  }

  // ป้องกัน Error จาก Drizzle: เช็คก่อนว่ามีข้อมูลให้อัปเดตจริงๆ ไหม
  if (Object.keys(updateData).length === 0) {
    return; // ถ้าไม่มีอะไรเปลี่ยนเลย (undefined หมด) ก็ให้ออกจากฟังก์ชันไปเลย
  }
  // ยิงอัปเดต Database
  return (
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning()
  )[0];
}
