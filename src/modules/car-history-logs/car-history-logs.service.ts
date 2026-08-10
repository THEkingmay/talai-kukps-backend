import db from "../../db/index.ts";
import { carHistoryLog } from "../../db/schema.ts";
import { eq, desc } from "drizzle-orm";
import type { CarHistoryLog, NewCarHistoryLog } from "../../db/types.ts";

export async function getByCarId(
  carId: string,
  limit: number = 50,
): Promise<CarHistoryLog[]> {
  return db
    .select()
    .from(carHistoryLog)
    .where(eq(carHistoryLog.carId, carId))
    .orderBy(desc(carHistoryLog.createdAt))
    .limit(limit);
}

/** Called by the background interval job every 60 seconds */
export async function insertMany(logs: NewCarHistoryLog[]): Promise<void> {
  if (logs.length === 0) return;
  await db.insert(carHistoryLog).values(logs);
}
