import db from "../../db/index.ts";
import { routePoints } from "../../db/schema.ts";
import { eq, asc } from "drizzle-orm";
import type { RoutePoint, NewRoutePoint } from "../../db/types.ts";

export async function getByRouteId(routeId: string): Promise<RoutePoint[]> {
    return db
        .select()
        .from(routePoints)
        .where(eq(routePoints.routeId, routeId))
        .orderBy(asc(routePoints.sequence));
}

export async function create(body: NewRoutePoint): Promise<RoutePoint> {
    const [point] = await db.insert(routePoints).values(body).returning();
    return point;
}

export async function update(
    id: string,
    body: Partial<NewRoutePoint>,
): Promise<RoutePoint> {
    const [point] = await db
        .update(routePoints)
        .set(body)
        .where(eq(routePoints.id, id))
        .returning();
    if (!point) throw new Error("Route point not found");
    return point;
}

export async function remove(id: string): Promise<void> {
    await db.delete(routePoints).where(eq(routePoints.id, id));
}
