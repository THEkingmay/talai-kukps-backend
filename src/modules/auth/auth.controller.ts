import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service.ts";
import { insertUserSchema } from "../../db/types.ts";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const registerSchema = insertUserSchema.extend({
  inviteCode: z.string(),
});
const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password ต้องมีอย่างน้อย 8 ตัวอักษร"),
});
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password, res);
    res.json({ success: true, user: result });
  } catch (error) {
    next(error);
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body, res);
    res.status(201).json({ success: true, user: result });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies.sessionId;
    await authService.logout(sessionId, res);
    res.json({ success: true, message: "Logged out" });
  } catch (error) {
    next(error);
  }
}

export async function loginWithSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await authService.loginWithSession(req);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function requestResetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await authService.requestResetPassword(req);
    res.json({
      success: true,
      message: "ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว",
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);

    await authService.resetPassword(token, newPassword);
    res.json({ success: true, message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (error) {
    next(error);
  }
}
