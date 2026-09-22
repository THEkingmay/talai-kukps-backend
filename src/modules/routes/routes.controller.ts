import type { Request, Response, NextFunction } from "express";
import * as routesService from "./routes.service.ts";
import { insertRouteSchema } from "../../db/types.ts";
import { z } from "zod";

const uuidSchema = z.object({ id: z.string().uuid() });

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await routesService.getAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    const result = await routesService.getById(id);
    if (!result)
      return res
        .status(404)
        .json({ success: false, message: "Route not found" });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = insertRouteSchema.parse(req.body);
    const result = await routesService.create(body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    const body = insertRouteSchema.partial().parse(req.body);
    const result = await routesService.update(id, body, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    await routesService.remove(id, req.user!.id);
    res.json({ success: true, message: "ลบสายการเดินรถสำเร็จ" });
  } catch (error) {
    next(error);
  }
}

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    await routesService.restore(id, req.user!.id);
    res.json({ success: true, message: "ยกเลิกการลบสายรถ" });
  } catch (error) {
    next(error);
  }
}
