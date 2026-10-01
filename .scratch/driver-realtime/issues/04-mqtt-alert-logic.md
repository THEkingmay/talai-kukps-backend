# 04: MQTT alert logic + WebSocket alert broadcast

**What to build:** ทุกครั้งที่รถส่ง GPS มา ระบบตรวจสอบว่าคนขับที่ควรขับรถคันนั้นได้กดเริ่มงานหรือยัง ถ้าไม่ได้กด (หรือกดหยุดแล้ว) จะส่ง WebSocket alert ไปยัง client ทุกคน — ส่งได้ครั้งเดียวต่อ session (ไม่ spam)

**Blocked by:** 01-websocket-type-field, 03-driving-logs-api

**Status:** done

- [x] MQTT handler lookup `car:{carId}:activeDriver` จาก Redis → ได้ driverId
- [x] ถ้าไม่มี key หรือ `driver:{driverId}`.status = "ended" → เรียก sendAlertIfNeeded()
- [x] `sendAlertIfNeeded()` ตรวจ `alertSentAt` ก่อนส่ง — ถ้ามีแล้วไม่ส่งซ้ำ
- [x] เมื่อส่ง alert → set `alertSentAt` ใน Redis
- [x] เมื่อ driver กดเริ่มใหม่ → reset `alertSentAt` = null (ticket 03 จัดการ)
- [x] broadcast payload shape: `{ type: "alert", alertType: "driver_not_confirmed", carId, driverId, message, timestamp }`
