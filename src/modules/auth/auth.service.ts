import type { Response, Request } from "express";
import type { NewUser } from "../../db/types.ts";
import db from "../../db/index.ts";
import { users, adminInvites } from "../../db/schema.ts";
import { and, eq } from "drizzle-orm";
import redisService from "../../services/redis.service.ts";
import type { SessionUserType } from "../../types/index.ts";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
    BadRequestError,
    NotFoundError,
} from "../../middlewares/error.middleware.ts";

interface UserResponse {
    id: string;
    email: string;
    role: "admin" | "user";
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

    if (!user) throw new NotFoundError("Invalid email or password");

    const isValid = await bcrypt.compare(password, user.hashPassword);
    if (!isValid) throw new BadRequestError("Invalid email or password");

    // Create session in Redis
    const sessionId = crypto.randomUUID();
    const sessionData: SessionUserType = {
        id: user.id,
        role: user.role,
        email: user.email,
        loginAt: new Date().toISOString(),
    };

    await redisService.hSet(`session:${sessionId}`, sessionData, 24 * 60 * 60);

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
        createdAt: user.createdAt.toISOString(),
    };
}

export async function register(
    body: RegisterBody,
    res: Response,
): Promise<UserResponse | undefined> {
    const { inviteCode, email } = body;
    // ถ้ามี inviteCode ให้เชคก่อน และเป็น admin ถ้าไม่มีแปลว่าเป็นผู้ใช้ปกติ
    if (inviteCode) {
        const existingInvite = await db
            .select()
            .from(adminInvites)
            .where(
                and(
                    eq(adminInvites.inviteCode, inviteCode),
                    eq(adminInvites.email, email),
                ),
            )
            .limit(1);
        if (!existingInvite || existingInvite.length === 0) {
            throw new BadRequestError("Invalid invite code");
        }
        body.role = "admin";
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    body.password = hashedPassword;
    const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

    if (existing) throw new BadRequestError("Email already registered");

    const [newUser] = await db
        .insert(users)
        .values({
            ...body,
            hashPassword: hashedPassword,
        })
        .returning();

    // Create session in Redis
    const sessionId = crypto.randomUUID();
    const sessionData: SessionUserType = {
        id: newUser.id,
        role: newUser.role,
        email: newUser.email,
        loginAt: new Date().toISOString(),
    };

    await redisService.hSet(`session:${sessionId}`, sessionData, 24 * 60 * 60);

    res.cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt.toISOString(),
    };
}

export async function loginWithSession(
    req: Request,
): Promise<UserResponse | null> {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) throw new Error("Session not found");
    const user = await redisService.hGetAll<SessionUserType>(
        `session:${sessionId}`,
    );
    if (!user) throw new Error("Session not found");
    const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
    if (!dbUser) throw new Error("User not found");
    return {
        id: dbUser[0].id,
        email: dbUser[0].email,
        role: dbUser[0].role,
        createdAt: dbUser[0].createdAt.toISOString(),
    };
}
export async function logout(sessionId: string, res: Response): Promise<void> {
    await redisService.delete(`session:${sessionId}`);
    res.clearCookie("sessionId");
}
