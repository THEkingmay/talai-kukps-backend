# 01: Expand WebSocket message schema with `type` field

**What to build:** เพิ่ม `type` field ใน WebSocket broadcast ทุก message เพื่อให้ frontend แยก location กับ alert ออกจากกันได้ โดยไม่ break consumer ที่มีอยู่ (additive change)

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `WebSocketLocationBroadcastType` มี field `type: "location"`
- [x] `WebSocketAlertBroadcastType` type ใหม่สำหรับ alert
- [x] `broadcast()` รับ union type ของทั้งสอง
- [x] call site ใน `app.ts` ส่ง `type: "location"` ไปด้วย
