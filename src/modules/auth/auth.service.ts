import type { Response } from "express";
import type { NewUser } from "../../db/types.ts";
import db from "../../db/index.ts";
import { users } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import redisService from "../../services/redis.service.ts";
import type { SessionUserType } from "../../types/index.ts";
import crypto from "crypto";
import bcrypt from "bcrypt";

export async function login(
    email: string,
    password: string,
    res: Response,
): Promise<{ email: string; role: string }> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!user) throw new Error("Invalid email or password");

    const isValid = await bcrypt.compare(password, user.hashPassword);
    if (!isValid) throw new Error("Invalid email or password");

    // Create session in Redis
    const sessionId = crypto.randomUUID();
    const sessionData: SessionUserType = {
        id: user.id,
        role: user.role,
        loginAt: new Date().toISOString(),
    };

    await redisService.hSet(`session:${sessionId}`, sessionData);

    res.cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { email: user.email, role: user.role };
}

export async function register(
    body: NewUser,
    res: Response,
): Promise<{ email: string; role: string }> {
    const hashedPassword = await bcrypt.hash(body.password, 10);
    body.password = hashedPassword;
    const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

    if (existing) throw new Error("Email already registered");

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
        loginAt: new Date().toISOString(),
    };

    await redisService.hSet(`session:${sessionId}`, sessionData);

    res.cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { email: newUser.email, role: newUser.role };
}

export async function logout(sessionId: string, res: Response): Promise<void> {
    await redisService.delete(`session:${sessionId}`);
    res.clearCookie("sessionId");
}
