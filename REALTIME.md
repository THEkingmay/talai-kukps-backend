# Realtime — WebSocket, MQTT, Redis, Workers

> เอกสารส่วนที่ **ไม่ใช่ REST** — ตำแหน่งรถวิ่งแบบ real-time
>
> ดู [`API_Documentation.md`](./API_Documentation.md)

---

## สารบัญ

1. [ภาพรวม data flow](#1-ภาพรวม-data-flow)
2. [WebSocket](#2-websocket)
3. [MQTT](#3-mqtt)
4. [Redis key layout](#4-redis-key-layout)
5. [Background workers](#5-background-workers)
6. [การเตรียมข้อมูลให้รถ](#6-การเตรียมข้อมูลให้รถ)
7. [Alert: รถวิ่งแต่คนขับยังไม่กดเริ่มงาน](#7-alert-รถวิ่งแต่คนขับยังไม่กดเริ่มงาน)

---

## 1. ภาพรวม data flow

```
   รถ (ESP32 + SIM7600C)
        │  publish ทุก 3 วินาที
        ▼
   MQTT Broker (HiveMQ Cloud)
        │  topic: cars/{carId}
        ▼
   ┌──────────────────────────────────────────────────┐
   │  Backend (src/app.ts → mqtt.service.ts)           │
   │                                                  │
   │  1. validate status ∈ {active, inactive}         │
   │  2. เติม createdAt = now()                        │
   │  3. ถ้า status เปลี่ยน → อัปเดต cars.status ใน PG │
   │  4. ถ้า status = active → เช็คว่าคนขับ confirm  │
     หรือยัง → อาจ broadcast alert                     │
   │  5. broadcast → WebSocket ทุก client              │
   │  6. บันทึกลง Redis car:position:{carId}           │
   └──────────────────────────────────────────────────┘
        │                    │
        │ worker ทุก 60 วินาที │ REST
        ▼                    ▼
   car_history_log      GET /cars/live-positions
   (PostgreSQL)         GET /car-history-logs/by-car/:carId
```

**จุดที่ต้องรู้**

- `createdAt` **ไม่ได้มาจากรถ** — server เป็นคนใส่ตอนรับข้อความ
- WebSocket เป็นช่องทาง **push ฝั่งเดียว** — server ส่งออกอย่างเดียว client ส่งอะไรกลับไม่ได้
- ถ้า Redis หาย (server restart / Redis ถูกล้าง) ตำแหน่งรถที่ `GET /cars/live-positions` จะถูกดึงจาก `car_history_log` ล่าสุดแทน โดยบังคับ `status: "inactive"`

---

## 2. WebSocket

### การเชื่อมต่อ

```
ws://localhost:3000/
```

- **ไม่มีการยืนยันตัวตน** — ไม่ต้องส่ง token, cookie, subprotocol อะไรเลย
- path ใด ๆ ก็ได้ (`new WebSocketServer({ server })` ไม่ได้จำกัด path)
- ไม่มีการตรวจ Origin — client จากเว็บไซต์ใดก็เชื่อมต่อได้

### ข้อจำกัด

| หัวข้อ            | ค่า                                                               |
| ----------------- | ----------------------------------------------------------------- |
| connection สูงสุด | 500 พร้อมกัน                                                      |
| เกินลิมิต         | ถูกปิดด้วย close code `1008`, reason `"Server at capacity"`       |
| heartbeat         | server ส่ง ping ทุก 30 วินาที · client ที่ไม่ตอบ pong จะถูกตัดสาย |
| ข้อความ           | ส่งเป็น **text frame** ที่เป็น JSON 1 ชิ้นต่อ 1 ข้อความ           |

> browser จะตอบ pong ให้เองอัตโนมัติ — ฝั่ง client ไม่ต้องทำอะไร แต่ React Native / Node client ต้องทำเอง

### ข้อความที่ server ส่งมา — มี 2 แบบ

#### `type: "location"` — ตำแหน่งรถ

ส่งทุกครั้งที่รถ publish มา (ประมาณทุก 3 วินาทีต่อรถ 1 คัน) และส่งอีกครั้งเมื่อระบบเปลี่ยนสถานะเป็น `inactive` เอง

```json
{
  "type": "location",
  "carId": "c0000000-0000-4000-8000-000000000001",
  "lat": 18.7883,
  "lng": 98.9853,
  "status": "active",
  "createdAt": "2025-01-16T04:30:00.000Z"
}
```

| Field       | Type                       | หมายเหตุ                           |
| ----------- | -------------------------- | ---------------------------------- |
| `type`      | `"location"`               | ใช้แยกประเภทข้อความ                |
| `carId`     | uuid                       | มาจาก MQTT topic ไม่ใช่จาก payload |
| `lat`       | number                     | ⚠️ จาก Redis อาจเป็น string        |
| `lng`       | number                     | ⚠️ จาก Redis อาจเป็น string        |
| `status`    | `"active"` \| `"inactive"` | มาจาก payload ที่รถส่งมา           |
| `createdAt` | ISO8601                    | server ใส่ให้ ไม่ใช่ข้อมูลจากรถ    |

#### `type: "alert"` — รถวิ่งแต่คนขับยังไม่กดเริ่มงาน

ดูรายละเอียดใน [หัวข้อ 7](#7-alert-รถวิ่งแต่คนขับยังไม่กดเริ่มงาน)

```json
{
  "type": "alert",
  "alertType": "driver_not_confirmed",
  "carId": "c0000000-0000-4000-8000-000000000001",
  "driverId": null,
  "message": "รถกำลังวิ่งแต่คนขับยังไม่ได้กดเริ่มงาน",
  "timestamp": "2025-01-16T04:30:00.000Z"
}
```

| Field      | Type         | หมายเหตุ                         |
| ---------- | ------------ | -------------------------------- |
| `driverId` | uuid \| null | `null` = ยังไม่มีใครกด start เลย |

> ⚠️ `alertType` มีค่าเดียวคือ `"driver_not_confirmed"` — ไม่มี alert ชนิดอื่นในระบบปัจจุบัน

### client ต้องทำอะไร

| เรื่อง         | ต้องทำ                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| reconnect      | ใช่ — ปิดเองเมื่อ connection เต็ม หรือ network หลุด แล้วต่อใหม่                               |
| initial state  | ต้องเรียก `GET /cars/live-positions` ก่อน เพื่อรู้ตำแหน่งล่าสุดของรถที่ยังไม่ส่งข้อความเข้ามา |
| กรองรถที่ถูกลบ | ต้องกรองเอง — WebSocket จะ broadcast รถที่ถูก soft delete ด้วยถ้ารถยังส่งข้อมูลอยู่           |
| `lat`/`lng`    | ควร `Number(msg.lat)` ก่อนใช้กับแผนที่                                                        |

---

## 3. MQTT

### การเชื่อมต่อของ Backend

ตั้งค่าใน `src/services/mqtt.service.ts`

| หัวข้อ              | ค่า                                                             |
| ------------------- | --------------------------------------------------------------- |
| Broker              | `MQTT_URL` (ปัจจุบันใช้ HiveMQ Cloud)                           |
| Username / Password | `MQTT_SERVER_USERNAME` / `MQTT_SERVER_PASSWORD`                 |
| clientId            | `talai-server-{random hex 8 ตัว}` — สุ่มใหม่ทุกครั้งที่ restart |
| keepalive           | 60 วินาที                                                       |
| reconnect           | ทุก 5 วินาที                                                    |
| connect timeout     | 30 วินาที                                                       |
| TLS                 | `rejectUnauthorized: true` — ตรวจ certificate                   |
| **Subscribe topic** | **`cars/#`** (ทุกรถ)                                            |

### Format ที่รถต้อง publish

**Topic**

```
cars/{carId}
```

`{carId}` ต้องเป็น **UUID ของรถในฐานข้อมูล** ตรงกับ `cars.id` ไม่ใช่ `carNumber` และไม่ใช่ `carMqttUsername`

ตัวอย่าง:

```
cars/c0000000-0000-4000-8000-000000000001
```

**Payload**

```json
{ "lat": 18.7883, "lng": 98.9853, "status": "active" }
```

| Field    | Type                       | Required | หมายเหตุ                                      |
| -------- | -------------------------- | :------: | --------------------------------------------- |
| `lat`    | number                     |    ✅    | Decimal degrees — **ไม่ใช่** NMEA `ddmm.mmmm` |
| `lng`    | number                     |    ✅    | Decimal degrees                               |
| `status` | `"active"` \| `"inactive"` |    ✅    | ค่าอื่นนอกเหนือจากนี้ → ข้อความถูก**ทิ้ง**    |

**สิ่งที่รถไม่ต้องส่ง**

- `carId` — มาจาก topic
- `createdAt` — server ใส่ให้เอง

**สิ่งที่ server จะทำกับข้อความ**

| ขั้นตอน                    | เงื่อนไข                                                     |
| -------------------------- | ------------------------------------------------------------ |
| ทิ้งข้อความ                | `status` ไม่ใช่ `active` หรือ `inactive` · JSON parse ไม่ได้ |
| อัปเดต `cars.status` ใน PG | เห็นรถครั้งแรก **หรือ** status เปลี่ยนจากครั้งก่อน           |
| เช็ค driver confirmation   | เฉพาะเมื่อ `status === "active"`                             |
| broadcast WebSocket        | ทุกข้อความที่ผ่าน                                            |
| บันทึก Redis               | ทุกข้อความที่ผ่าน                                            |

> 🔴 **Backend เชื่อ topic ที่รถส่งมาโดยไม่ตรวจสอบ** — ถ้ารถคันหนึ่ง publish ไปที่ `cars/{uuid ของรถอีกคัน}` ข้อมูลจะไปทับตำแหน่งรถนั้น ดู `KNOWN_ISSUES.md`

---

## 4. Redis key layout

ทุก key ถูกสร้างผ่าน factory ใน `src/services/redis-keys.ts` — แก้ที่นี่ที่เดียว

### Session & Auth

| Key                             | Type | TTL           | ค่า                   |
| ------------------------------- | ---- | ------------- | --------------------- |
| `session:session:{sessionId}`   | hash | 7 วัน         | `{ id, email, role }` |
| `session:invite:{email}`        | hash | **ไม่มี TTL** | `{ inviteCode }`      |
| `session:resetpassword:{token}` | hash | 15 นาที       | `{ email }`           |

> ⚠️ `session:invite:{email}` ไม่มี TTL → invite code ค้างใน Redis ตลอดอายุ process ถ้าผู้ถูกเชิญไม่สมัคร

### รถ

| Key                        | Type    | TTL           | ค่า                               |
| -------------------------- | ------- | ------------- | --------------------------------- |
| `car:position:{carId}`     | hash    | **ไม่มี TTL** | `{ lat, lng, status, createdAt }` |
| `car:activeDriver:{carId}` | string  | **ไม่มี TTL** | `driverId`                        |
| `car:alertSent:{carId}`    | string  | **ไม่มี TTL** | `"true"` (flag กัน alert ซ้ำ)     |
| `car:position:*`           | pattern | —             | ใช้ scan ทุกรถ                    |

### คนขับ

| Key                       | Type          | TTL           | ค่า                                     |
| ------------------------- | ------------- | ------------- | --------------------------------------- |
| `driver:state:{driverId}` | string (JSON) | **ไม่มี TTL** | `{ status, carId, logId, alertSentAt }` |

### ดูข้อมูลทั้งหมดใน Redis

```bash
curl http://localhost:3000/see-redis    # เฉพาะ dev — ดู API_Documentation.md หัวข้อ 7
```

---

## 5. Background workers

ทั้งสอง worker ทำงานใน `setInterval` ที่ `src/app.ts` — **ไม่มีกลไกหยุดหรือจัดตารางซ้ำ ถ้า process รัน 2 ตัว worker จะซ้ำกันทำงาน**

### Worker A — บันทึกประวัติตำแหน่ง (ทุก 60 วินาที)

**ทำอะไร**

1. scan Redis key `car:position:*`
2. ข้ามรถที่: ไม่มีข้อมูล, `lat` หรือ `lng` เป็น `0`, หรือ `status === "inactive"`
3. ข้ามรถที่ `createdAt` เหมือนครั้งก่อนหน้า (กันบันทึกซ้ำ)
4. insert ลงตาราง `car_history_log` ทีเดียวเป็น batch

**ผลลัพธ์** → ข้อมูลที่ `GET /car-history-logs/by-car/:carId` คืนมา

> รถ publish ทุก 3 วินาที แต่บันทึกทุก 60 วินาที → **ประวัติจะหยาบกว่าความจริงประมาณ 20 เท่า**

### Worker B — ตัดสถานะรถที่เงียบนานเกิน (ทุก 60 วินาที)

**ทำอะไร**

1. scan Redis key `car:position:*`
2. ข้ามรถที่: ไม่มีข้อมูล, พิกัดเป็น `0`, หรือ `status` เป็น `inactive` อยู่แล้ว
3. ถ้า `createdAt` เก่ากว่า **5 นาที** → ถือว่ารถหายไป:
   - เปลี่ยน `status` ใน Redis เป็น `inactive`
   - อัปเดต `cars.status` ใน PostgreSQL เป็น `inactive`
   - broadcast `{ type: "location", ..., status: "inactive" }` ทาง WebSocket

**ทำไมต้องมี** — ถ้ารถจอดหรือสัญญาณหลุด ระบบจะได้ไม่ต้องรอให้รถส่ง `inactive` มาเอง (ซึ่งอุปกรณ์ปัจจุบันไม่เคยส่ง)

> ⚠️ ถ้า Redis ถูกล้าง `createdAt` จะหายไปด้วย → รถที่กำลังวิ่งจะถูกมองว่า "ไม่มีข้อมูล" ไม่ใช่ "หายไป" → worker B จะข้ามรถนั้น รถจะค้างสถานะ `active` ใน DB จนกว่าจะ publish ใหม่

---

## 6. การเตรียมข้อมูลให้รถ

### ขั้นตอน

```
1. POST /cars { routeId, carNumber }
      → backend สร้าง MQTT credential อัตโนมัติ
        • username = "car_" + random 6 bytes → hex  (เช่น car_a1b2c3d4e5f6)
        • password = random 16 bytes → hex 32 ตัวอักษร
        • password ถูกเข้ารหัส AES-256-CBC ด้วย ENCRYPTION_KEY เก็บลง DB

2. GET /cars/mqtt-credentials/:carId     ← admin / superadmin เท่านั้น
      → { carMqttUsername, decryptedMqttPassword }   ← รหัสผ่านจริงแบบถอดแล้ว

3. คนเก็บค่าทั้ง 3 (carId, username, password) ไปใส่ใน firmware แล้ว flash ใหม่
```

### เลขพนธ์ของ credential

| หัวข้อ             | ค่า                               |
| ------------------ | --------------------------------- |
| Algorithm          | AES-256-CBC                       |
| Key                | `sha256(ENCRYPTION_KEY)`          |
| IV                 | random 16 bytes สร้างใหม่ทุกครั้ง |
| รูปแบบที่เก็บลง DB | `{iv hex}:{ciphertext hex}`       |

> 🔴 **ดู `KNOWN_ISSUES.md` — firmware ปัจจุบันมีโอกาสว่าใส่รหัสผ่านแบบเข้ารหัสแล้ว ไม่ใช่ค่าจริง** ต้องก๊อปค่าจากหน้าจอ Credential เท่านั้น

### หมุนเวียน credential

```
POST /cars/mqtt-credentials/:carId/reset
  → สร้างค่าใหม่ทันที (credential เดิมใช้ไม่ได้แล้ว)
  → ⚠️ response ไม่มี credential ใหม่ ต้องเรียก GET ต่อทันที
  → ต้อง flash อุปกรณ์ใหม่ทุกคัน
```

### สิ่งที่ระบบยังไม่มี

| ขาด                                            | ผลกระทบ                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| OTA / endpoint ให้อุปกรณ์ claim credential เอง | ต้อง flash ใหม่ทุกครั้งที่เปลี่ยน credential                   |
| endpoint ที่คืน broker URL / port / topic      | admin ต้องหาเองจากค่าคงที่ใน firmware ว่าอะไร topic ที่ถูกต้อง |
| ACL ฝั่ง broker ต่อรถ                          | ดูหัวข้อถัดไป                                                  |

### ACL ที่ควรตั้งบน Broker

| Account                        | สิทธิ์ที่ควรมี                                             |
| ------------------------------ | ---------------------------------------------------------- |
| `talai-server-*` (ของ backend) | `cars/#` — subscribe ทุกรถ                                 |
| `car_*` (ของแต่ละรถ)           | **เฉพาะ** `cars/{carId ของตัวเอง}` — publish ได้อย่างเดียว |

> ตอนนี้ยังไม่มีการบังคับ ACL ฝั่ง backend → ดู `KNOWN_ISSUES.md`

---

## 7. Alert: รถวิ่งแต่คนขับยังไม่กดเริ่มงาน

### เงื่อนไขที่จะเกิด

ทุกครั้งที่รถ publish มาด้วย `status: "active"` ระบบจะตรวจ:

```
อ่าน car:activeDriver:{carId}
  ├── ไม่มี          → ส่ง alert (driverId = null)
  └── มี driverId
        → อ่าน driver:state:{driverId}
             ├── ไม่มี หรือ status = "ended"  → ส่ง alert
             └── status = "active"             → ไม่ส่ง (ปกติ)
```

### กัน alert ซ้ำ

ระบบส่งให้ **ครั้งเดียวต่อ session** โดยใช้ flag:

| กรณี                                    | flag ที่ใช้                                      |
| --------------------------------------- | ------------------------------------------------ |
| ยังไม่มีใครกด start (`driverId = null`) | key `car:alertSent:{carId}`                      |
| มี driver แต่หยุดงานแล้ว                | field `alertSentAt` ใน `driver:state:{driverId}` |

flag จะถูก**รีเซ็ต** เมื่อ driver กด start ใหม่ (`POST /driving-logs/start`)

### ⚠️ ข้อควรระวังสำคัญ

**Alert จะเกิดต่อเนื่องไปเรื่อย ๆ** ถ้าไม่มี client ไหนเรียก `POST /driving-logs/start`

เหตุผล: `car:activeDriver:{carId}` ถูกเขียน**เฉพาะ** โดย `POST /driving-logs/start` เท่านั้น ถ้าฝั่ง client ไม่มีปุ่ม "เริ่มงาน" หรือไม่ได้เรียก endpoint นี้ ระบบก็จะไม่มีทางรู้ว่ามีคนขับ

ตรวจสอบว่ามี client เรียกหรือยัง:

```bash
# ดูว่ามี activeDriver สำหรับรถคันนี้ไหม
curl http://localhost:3000/see-redis | grep activeDriver
```

---

**เอกสารก่อนหน้า** — [`API_Documentation.md`](./API_Documentation.md)
**เอกสารถัดไป** — [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)
