import type { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service.ts";
import { z } from "zod";
import {
  BadRequestError,
  UnauthorizedError,
} from "../../middlewares/error.middleware.ts";

const uuidSchema = z.uuid();

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.getAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError("คุณไม่มีสิทธิ์เข้าถึงข้อมูล");
    }
    if (req.user && !["admin", "superadmin"].includes(req.user.role)) {
      throw new UnauthorizedError("คุณไม่มีสิทธิ์เข้าถึงข้อมูล");
    }
    const { id } = req.params;
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId || !parsedId.data)
      throw new BadRequestError("ข้อมูลไอดีไม่ถูกต้อง");
    const result = await usersService.getById(parsedId.data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const result = await usersService.getById(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้
    if (req.user?.role !== "superadmin")
      return res.status(403).json({
        success: false,
        message: "เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้",
      });

    const { id } = req.params;
    const parsedId = uuidSchema.parse(id);

    await usersService.deleteUser(parsedId);
    res.json({ success: true, message: "ลบผู้ใช้เรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}

export async function restoreDeletedUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้
    if (req.user?.role !== "superadmin")
      return res.status(403).json({
        success: false,
        message: "เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้",
      });

    const { id } = req.params;
    const parsedId = uuidSchema.parse(id);

    await usersService.restoreDeletedUser(parsedId);
    res.json({ success: true, message: "ยกเลิกการลบผู้ใช้" });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const userId = uuidSchema.parse(id);
    if (req.user?.id !== id) {
      return res.status(403).json({
        success: false,
        message: "ไม่มีสิทธิ์แก้ไข profile ของผู้ใช้อื่น",
      });
    }
    const { firstName, lastName, phoneNumber } = req.body;
    const profileImage = req.file;
    const userProfile = await usersService.updateProfile(
      userId,
      firstName,
      lastName,
      profileImage,
      phoneNumber,
    );
    if (!userProfile)
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    res.json({ success: true, user: userProfile });
  } catch (error) {
    next(error);
  }
}
