import db from "../../db/index.ts";
import { cars, carHistoryLog } from "../../db/schema.ts";
import { eq, desc } from "drizzle-orm";
import type { NewCar, ResponseCarData } from "../../db/types.ts";
import { NotFoundError } from "../../middlewares/error.middleware.ts";
import { generateMqttCredential } from "./utils/mqtt-credential.ts";
import redisService from "../../services/redis.service.ts";
import type { MqttMessageType } from "../../types/index.ts";
import type { WebSocketLocationBroadcastType } from "../../types/index.ts";

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

export async function updateStatusFromServer(
  carId: string,
  status: "active" | "inactive",
): Promise<void> {
  await db.update(cars).set({ status }).where(eq(cars.id, carId));
}

/** ดึงตำแหน่งล่าสุดของรถทุกคันจาก Redis สำหรับ initial state ตอน frontend โหลดครั้งแรก */
// บางครั้่งใน redis จะไม่มีข้อมูลรถ เช่น เซิฟล่ม หรือเกิดข้อผิดพลาดในการอัปเดตข้อมูล
// ให้ไปดึงตำแหน่งล่าสุดจาก supabaseแทน และให้ status เป็น "inactive" ถ้าไม่มีข้อมูลใน redis
export async function getLivePositions(): Promise<
  WebSocketLocationBroadcastType[]
> {
  const keys = await redisService.keys("car:*");
  const results: WebSocketLocationBroadcastType[] = [];

  for (const key of keys) {
    const carData = await redisService.hGetAll<MqttMessageType>(key);
    if (!carData || !carData.lat || !carData.lng) continue;

    const carId = key.replace("car:", "");
    results.push({ carId, ...carData });
  }

  const allCarId = await db.select({ id: cars.id }).from(cars);
  const filterCarNotInRedis = allCarId.filter(
    (car) => !keys.includes(`car:${car.id}`),
  );
  const filterCarNotInRedisIds = filterCarNotInRedis.map((car) => car.id);

  if (filterCarNotInRedisIds.length === 0) return results;

  // เมื่อได้ไอดีของรถที่ไม่มีใน redis แล้วให้ไปดึงประัติกาเดินทางล่าสุดมา
  for (const carId of filterCarNotInRedisIds) {
    const carHistory = await db
      .select()
      .from(carHistoryLog)
      .where(eq(carHistoryLog.carId, carId))
      .orderBy(desc(carHistoryLog.createdAt))
      .limit(1);
    if (carHistory.length === 0) continue;
    const { lat, lng, createdAt } = carHistory[0];
    results.push({
      carId,
      lat,
      lng,
      status: "inactive",
      createdAt: createdAt.toISOString(),
    });
  }

  return results;
}

export async function getMqttCredentials(
  id: string,
): Promise<{ carMqttUsername: string; encryptedMqttPassword: string }> {
  const car = await db.select().from(cars).where(eq(cars.id, id)).limit(1);
  if (!car || !car[0].carMqttUsername || !car[0].encryptedMqttPassword)
    throw new NotFoundError("ไม่พบข้อมูลรถในระบบ");
  return {
    carMqttUsername: car[0].carMqttUsername,
    encryptedMqttPassword: car[0].encryptedMqttPassword,
  };
}

export async function resetMqttCredentials(id: string): Promise<void> {
  const newCredentials = generateMqttCredential();
  await db.update(cars).set(newCredentials).where(eq(cars.id, id));
}
