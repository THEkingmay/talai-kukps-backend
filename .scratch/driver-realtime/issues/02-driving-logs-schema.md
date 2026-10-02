# 02: Add `drivingLogs` DB table

**What to build:** สร้างตาราง `driving_logs` ใน PostgreSQL พร้อม enum `driving_status` และ FK ไปยัง `car_driver_shifts` เพื่อรองรับการบันทึกว่าคนขับกดเริ่ม/หยุดงานจริงๆ เมื่อไหร่

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `drivingStatusEnum` ("active" | "ended") ใน schema.ts
- [x] `drivingLogs` table ใน schema.ts
- [x] Drizzle types (select/insert) ใน db/types.ts
- [x] migration รัน generate + push สำเร็จ
