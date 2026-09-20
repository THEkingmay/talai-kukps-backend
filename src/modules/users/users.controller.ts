import type { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service.ts";
import { z } from "zod";

const idSchema = z.string().min(1);

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.getAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// export async function getMe(req: Request, res: Response, next: NextFunction) {
//     try {
//         const userId = req.user!.id;
//         const result = await usersService.getById(userId);
//         res.json({ success: true, data: result });
//     } catch (error) {
//         next(error);
//     }
// }

export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้
    if (req.user?.role !== "superadmin")
      return res
        .status(403)
        .json({
          success: false,
          message: "เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้",
        });

    const { id } = req.params;
    const parsedId = idSchema.parse(id);

    await usersService.deleteUser(parsedId);
    res.json({ success: true, message: "ลบผู้ใช้เรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const parsedId = idSchema.parse(id);

    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "สถานะไม่ถูกต้อง" });
    }

    await usersService.updateUserStatus(parsedId, status);
    res.json({ success: true, message: "สถานะผู้ใช้ถูกอัปเดตเรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}
