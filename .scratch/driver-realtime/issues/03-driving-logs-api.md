# 03: Driver start/end API + Redis state

**What to build:** คนขับสามารถกดเริ่มงานและกดหยุดงานได้ผ่าน API โดยระบบจะบันทึกลง DB และ sync สถานะลง Redis สำหรับให้ MQTT handler ตรวจสอบแบบ real-time

**Blocked by:** 02-driving-logs-schema

**Status:** done

- [x] `POST /driving-logs/start` — รับ `shiftId`, insert `drivingLogs` (status=active), set Redis `driver:{driverId}` + `car:{carId}:activeDriver`
- [x] `POST /driving-logs/end` — รับ `logId`, update endedAt + status=ended, update Redis `driver:{driverId}`.status = "ended"
- [x] `GET /driving-logs/my` — driver ดูประวัติตัวเองได้
- [x] `GET /driving-logs` — admin ดูทั้งหมดได้
- [x] route ลงทะเบียนใน `src/routes/index.ts`
- [x] guard: driver กดเริ่มได้เฉพาะ shift ที่ assign ให้ตัวเองเท่านั้น
