import type { Request, Response, NextFunction } from "express";
import * as routePointsService from "./route-points.service.ts";
import { insertRoutePointSchema } from "../../db/types.ts";
import { z } from "zod";

const uuidSchema = z.object({ id: z.string().uuid() });
const routeIdSchema = z.object({ routeId: z.string().uuid() });

export async function getByRouteId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { routeId } = routeIdSchema.parse(req.params);
    const result = await routePointsService.getByRouteId(routeId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const inputData = Array.isArray(req.body) ? req.body : [req.body];
    const body = z.array(insertRoutePointSchema).parse(inputData);
    await routePointsService.create(body);
    res.status(201).json({ success: true, message: "เพิ่มจุดจอดสำเร็จ" });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    const body = insertRoutePointSchema.partial().parse(req.body);
    const result = await routePointsService.update(id, body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    await routePointsService.remove(id);
    res.json({ success: true, message: "ลบจุดจอดสำเร็จ" });
  } catch (error) {
    next(error);
  }
}
