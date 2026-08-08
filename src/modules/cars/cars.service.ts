import db from "../../db/index.ts";
import { cars } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import type { NewCar, ResponseCarData } from "../../db/types.ts";
import { NotFoundError } from "../../middlewares/error.middleware.ts";
import { generateMqttCredential } from "./utils/mqtt-credential.ts";


export async function getAll(): Promise<ResponseCarData[]> {
    const carList = await db.select().from(cars);
    return carList.map(({ encryptedMqttPassword, ...car }) => car);
}

export async function getById(id: string): Promise<ResponseCarData | null> {
    const [car] = await db.select().from(cars).where(eq(cars.id, id)).limit(1);
    if (!car) return null;
    const { encryptedMqttPassword, ...resData } = car;
    return resData;
}

export async function create(
    body: NewCar,
    updatedBy: string,
): Promise<ResponseCarData> {
    const mqttCreds = generateMqttCredential();
    const [car] = await db
        .insert(cars)
        .values({
            carMqttUsername: mqttCreds.carMqttUsername,
            encryptedMqttPassword: mqttCreds.encryptedMqttPassword,
            ...body,
            updatedBy,
        })
        .returning();
    const { encryptedMqttPassword, carMqttUsername, ...resData } = car;
    return resData;
}

// แก้ได้แค่ เลขรถ , routeId
export async function update(
    id: string,
    body: Partial<NewCar>,
    updatedBy: string,
): Promise<ResponseCarData> {
    const [car] = await db
        .update(cars)
        .set({ ...body, updatedBy, updatedAt: new Date() })
        .where(eq(cars.id, id))
        .returning();
    if (!car) throw new NotFoundError("ไม่พบข้อมูลรถในระบบ");
    const { encryptedMqttPassword, carMqttUsername, ...resData } = car;
    return resData;
}

export async function remove(id: string): Promise<void> {
    await db.delete(cars).where(eq(cars.id, id));
}
