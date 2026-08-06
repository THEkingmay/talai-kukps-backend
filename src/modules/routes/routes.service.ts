import db from "../../db/index.ts";
import { routes } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { Route, NewRoute } from "../../db/types.ts";
import { NotFoundError } from "../../middlewares/error.middleware.ts";

export async function getAll(): Promise<Route[]> {
    return db.select().from(routes);
}

export async function getById(id: string): Promise<Route | null> {
    const [route] = await db
        .select()
        .from(routes)
        .where(eq(routes.id, id))
        .limit(1);
    return route ?? null;
}

export async function create(body: NewRoute, updatedBy: string): Promise<Route> {
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

export async function remove(id: string): Promise<void> {
    await db.delete(routes).where(eq(routes.id, id));
}
