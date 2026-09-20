import type { Response, Request } from "express";
import type { NewUser } from "../../db/types.ts";
import db from "../../db/index.ts";
import { users, adminInvites } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import redisService from "../../services/redis.service.ts";
import type { SessionUserType } from "../../types/index.ts";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../middlewares/error.middleware.ts";
import emailService from "../../services/email.service.ts";

// ไม่เก็บสถานะเพราะมันเปลี่ยนได้ตลอด
interface UserResponse {
  id: string;
  email: string;
  role: "superadmin" | "admin" | "user";
  status: "active" | "suspended" | "deleted";
  createdAt: string;
}

interface RegisterBody extends NewUser {
  inviteCode?: string;
}

export async function login(
  email: string,
  password: string,
  res: Response,
): Promise<UserResponse | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) throw new NotFoundError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

  if (user.status === "deleted" || user.status === "suspended")
    throw new UnauthorizedError("บัญชีของคุณถูกระงับหรือถูกลบแล้ว");

  const isValid = await bcrypt.compare(password, user.hashPassword);
  if (!isValid) throw new BadRequestError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

  // Create session in Redis
  const sessionId = crypto.randomUUID();
  const sessionData: SessionUserType = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  await redisService.hSet(
    `session:${sessionId}`,
    sessionData,
    7 * 24 * 60 * 60,
  );

  res.cookie("sessionId", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function register(
  body: RegisterBody,
  res: Response,
): Promise<UserResponse | undefined> {
  const { inviteCode, email, password } = body;

  // 1. ตรวจสอบสิทธิ์ Admin หากมี inviteCode
  if (inviteCode) {
    const [existingEmail] = await db
      .select()
      .from(adminInvites)
      .where(eq(adminInvites.email, email))
      .limit(1);

    if (!existingEmail) {
      throw new BadRequestError("คุณไม่ได้รับอนุญาตจากผู้ดูแลระบบ");
    }
    if (existingEmail.status !== "pending") {
      throw new BadRequestError("รหัสเชิญนี้ถูกใช้งานหรือยกเลิกไปแล้ว");
    }

    const redisInvite = await redisService.hGetAll<{ inviteCode: string }>(
      `invite:${email}`,
    );

    if (!redisInvite || redisInvite.inviteCode !== inviteCode) {
      throw new BadRequestError("รหัสเชิญไม่ถูกต้องหรือหมดอายุ");
    }

    body.role = "admin";
  }

  // 2. ตรวจสอบอีเมลซ้ำ
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) throw new BadRequestError("อีเมลนี้ถูกลงทะเบียนในระบบแล้ว");

  // 3. Hash Password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. บันทึกลง DB ด้วย Transaction
  const [newUser] = await db.transaction(async (tx) => {
    const { password: _, inviteCode: __, ...userData } = body;

    const [newUser] = await tx
      .insert(users)
      .values({
        ...userData,
        hashPassword: hashedPassword,
      })
      .returning();

    if (inviteCode) {
      await tx
        .update(adminInvites)
        .set({ status: "accepted" })
        .where(eq(adminInvites.email, email));
    }

    return [newUser];
  });

  // 5. ลบ invite code ออกจาก Redis เมื่อลงทะเบียนสำเร็จแล้ว
  if (inviteCode) {
    await redisService.delete(`invite:${email}`);
  }

  // 6. Create session in Redis
  const sessionId = crypto.randomUUID();
  const sessionData: SessionUserType = {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  };

  await redisService.hSet(
    `session:${sessionId}`,
    sessionData,
    7 * 24 * 60 * 60,
  );

  res.cookie("sessionId", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    id: newUser.id,
    email: newUser.email,
    status: newUser.status,
    role: newUser.role,
    createdAt: newUser.createdAt.toISOString(),
  };
}

export async function loginWithSession(
  req: Request,
): Promise<UserResponse | null> {
  const sessionId = req.cookies.sessionId;
  if (!sessionId)
    throw new UnauthorizedError("ไม่พบเซสชัน กรุณาเข้าสู่ระบบอีกครั้ง");

  const user = await redisService.hGetAll<SessionUserType>(
    `session:${sessionId}`,
  );
  if (!user) throw new UnauthorizedError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!dbUser) throw new UnauthorizedError("ไม่พบข้อมูลผู้ใช้งานในระบบ");

  if (dbUser.status !== "active")
    throw new UnauthorizedError("ผู้ใช้งานถูกระงับ หรือ ถูกลบ");

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    status: dbUser.status,
    createdAt: dbUser.createdAt.toISOString(),
  };
}

export async function logout(sessionId: string, res: Response): Promise<void> {
  await redisService.delete(`session:${sessionId}`);
  res.clearCookie("sessionId");
}

export async function requestResetPassword(req: Request) {
  const { email } = req.body;
  // 1. ค้นหาผู้ใช้งานจากอีเมล
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new NotFoundError("ไม่พบผู้ใช้งานที่มีอีเมลนี้");

  // 2. สร้างลิงก์รีเซ็ตรหัสผ่าน
  const token = crypto.randomBytes(32).toString("hex");

  // 3. บันทึกลิงก์รีเซ็ตรหัสผ่านในฐานข้อมูล 15 นาที ใน redis
  await redisService.hSet(`resetpassword:${token}`, { email }, 15 * 60);

  // 4. ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของผู้ใช้
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

  await emailService.sendResetPasswordEmail(email, resetLink);
}

export async function resetPassword(token: string, newPassword: string) {
  const userData = await redisService.hGetAll<{ email: string }>(
    `resetpassword:${token}`,
  );
  if (!userData) throw new NotFoundError("โทเคนไม่ถูกต้องหรือหมดอายุ");

  const { email } = userData;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db
    .update(users)
    .set({ hashPassword: hashedPassword })
    .where(eq(users.email, email));

  await redisService.delete(`resetpassword:${token}`);
}
