import db from "../../db/index.ts";
import { routes, cars } from "../../db/schema.ts";
import { eq, isNull } from "drizzle-orm";
import type { Route, NewRoute } from "../../db/types.ts";
import { NotFoundError } from "../../middlewares/error.middleware.ts";
import type { Request } from "express";

export async function getAll(req: Request): Promise<Route[]> {
  if (req.user && ["admin", "superadmin"].includes(req.user.role)) {
    return db.select().from(routes).orderBy(routes.createdAt);
  }
  // ถ้าไม่ใช่แอดมินให้ส่งที่ไม่ถูกลบกลับไป
  return db
    .select()
    .from(routes)
    .where(isNull(routes.deletedAt))
    .orderBy(routes.createdAt);
}

export async function getById(id: string, req: Request): Promise<Route | null> {
  if (req.user && ["admin", "superadmin"].includes(req.user.role)) {
    const [route] = await db
      .select()
      .from(routes)
      .where(eq(routes.id, id))
      .limit(1);
    if (!route) return null;
    return route as Route;
  }
  const [route] = await db
    .select()
    .from(routes)
    .where(eq(routes.id, id))
    .limit(1);
  if (route.deletedAt) return null;
  return route ?? null;
}

export async function create(
  body: NewRoute,
  updatedBy: string,
): Promise<Route> {
  const [route] = await db
    .insert(routes)
    .values({ ...body, updatedBy })
    .returning();
  return route;
}

export async function update(
  id: string,
  body: Partial<NewRoute>,
  updatedBy: string,
): Promise<Route> {
  const [route] = await db
    .update(routes)
    .set({ ...body, updatedBy, updatedAt: new Date() })
    .where(eq(routes.id, id))
    .returning();
  if (!route) throw new NotFoundError("ไม่พบข้อมูลเส้นทางในระบบ");
  return route;
}

export async function remove(id: string, updatedBy: string): Promise<void> {
  await db
    .update(routes)
    .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy })
    .where(eq(routes.id, id));

  // setRoute ID == null ของรถทุกคันที่เชื่อมอย่
  await db.update(cars).set({ routeId: null }).where(eq(cars.routeId, id));
}

export async function restore(id: string, updatedBy: string): Promise<void> {
  await db
    .update(routes)
    .set({ deletedAt: null, updatedAt: new Date(), updatedBy })
    .where(eq(routes.id, id));
}
