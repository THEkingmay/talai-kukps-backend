import type { Request, Response, NextFunction } from "express";
import * as carsService from "./cars.service.ts";
import { insertCarSchema } from "../../db/types.ts";
import { z } from "zod";

const uuidSchema = z.object({ id: z.string().uuid() });

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await carsService.getAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getLivePositions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await carsService.getLivePositions();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    const result = await carsService.getById(id);
    if (!result)
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลรถ" });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const createBodySchema = z.object({
      routeId: z.string(),
      carNumber: z.string(),
    });
    const body = createBodySchema.parse(req.body);
    const result = await carsService.create({ ...body }, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const updateBodySchema = z.object({
      id: z.string(),
      routeId: z.string(),
      carNumber: z.string(),
      status: z.enum(["inactive", "active"]),
    });
    const { id } = uuidSchema.parse(req.params);
    const body = updateBodySchema.parse(req.body);
    const result = await carsService.update(id, body, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidSchema.parse(req.params);
    await carsService.remove(id);
    res.json({ success: true, message: "ลบข้อมูลรถสำเร็จ" });
  } catch (error) {
    next(error);
  }
}

export async function getMqttCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = uuidSchema.parse(req.params);
    const result = await carsService.getMqttCredentials(id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
