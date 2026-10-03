import db from "../../db/index.ts";
import { notifications } from "../../db/schema.ts";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { NewNotification, NotificationAlertType } from "../../db/types.ts";

export interface GetNotificationsParams {
  alertType?: NotificationAlertType;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

/** บันทึก alert log 1 แถว (เรียกจาก src/app.ts แบบ fire-and-forget) */
export async function insertNotification(
  input: NewNotification,
): Promise<void> {
  await db.insert(notifications).values(input);
}

/** ดู log alert ย้อนหลัง เรียงจากใหม่ไปเก่า (เฉพาะ admin/superadmin — คุมที่ controller) */
export async function getNotifications({
  alertType,
  from,
  to,
  limit,
  offset,
}: GetNotificationsParams) {
  const conditions = [];
  if (alertType) conditions.push(eq(notifications.alertType, alertType));
  if (from) conditions.push(gte(notifications.createdAt, from));
  if (to) conditions.push(lte(notifications.createdAt, to));

  return db
    .select()
    .from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}
