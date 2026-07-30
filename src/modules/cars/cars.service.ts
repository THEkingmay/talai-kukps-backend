import db from "../../db/index.ts";
import { cars } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { Car, NewCar } from "../../db/types.ts";

export async function getAll(): Promise<Car[]> {
    return db.select().from(cars);
}

export async function getById(id: string): Promise<Car | null> {
    const [car] = await db.select().from(cars).where(eq(cars.id, id)).limit(1);
    return car ?? null;
}

export async function create(
    body: NewCar,
    updatedBy: string,
): Promise<Car> {
    const [car] = await db
        .insert(cars)
        .values({ ...body, updatedBy })
        .returning();
    return car;
}

export async function update(
    id: string,
    body: Partial<NewCar>,
    updatedBy: string,
): Promise<Car> {
    const [car] = await db
        .update(cars)
        .set({ ...body, updatedBy, updatedAt: new Date() })
        .where(eq(cars.id, id))
        .returning();
    if (!car) throw new Error("Car not found");
    return car;
}

export async function remove(id: string): Promise<void> {
    await db.delete(cars).where(eq(cars.id, id));
}
