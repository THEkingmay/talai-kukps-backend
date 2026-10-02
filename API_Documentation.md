# API Documentation — talai-kukps-backend

> เอกสารนี้เขียนจากโค้ดจริง ณ commit ปัจจุบัน — ทุกตัวอย่าง request/response ถูกตรวจกับ `src/` แล้ว
>
> ⚠️ ตัวอย่างทุกตัวในเอกสารนี้เป็น **ค่าสมมติ** ใช้ UUID แบบคงที่เพื่อให้จำง่ายและนำไปวางทดสอบต่อได้

**ไฟล์ที่เกี่ยวข้อง**

| ไฟล์                             | เนื้อหา                                              |
| -------------------------------- | ---------------------------------------------------- |
| `API_Documentation.md` (ไฟล์นี้) | REST API ทั้งหมด 46 endpoint                         |
| `REALTIME.md`                    | WebSocket, MQTT, Redis key layout, background worker |

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [การยืนยันตัวตน (Authentication)](#2-การยืนยันตัวตน-authentication)
3. [สิทธิ์ตามบทบาท (Roles)](#3-สิทธิ์ตามบทบาท-roles)
4. [Workflow ที่ต้องเรียกตามลำดับ](#4-workflow-ที่ต้องเรียกตามลำดับ)
5. [Reference ทุก Endpoint](#5-reference-ทุก-endpoint)
6. [Data Models](#6-data-models)
7. [Dev-only Endpoints](#7-dev-only-endpoints)
8. [สิ่งที่ทำให้เข้าใจผิด](#8-สิ่งที่ทำให้เข้าใจผิด)

---

## 1. ภาพรวมระบบ

| หัวข้อ            | ค่า                                                                           |
| ----------------- | ----------------------------------------------------------------------------- |
| Base URL (dev)    | `http://localhost:3000`                                                       |
| Port              | `process.env.PORT` ค่าเริ่มต้น `3000`                                         |
| Framework         | Express 5.2.1                                                                 |
| Database          | PostgreSQL ผ่าน Drizzle ORM                                                   |
| Cache / Session   | Redis                                                                         |
| **Global prefix** | **ไม่มี** — path ทุกตัวเริ่มที่ root ตรง ๆ เช่น `/cars` ไม่ใช่ `/api/v1/cars` |
| ฐานข้อมูลชื่อ     | `talai` (schema ใน Drizzle)                                                   |

### Middleware chain (ตามลำดับที่ทำงาน)

1. `cors` — ยอมรับเฉพาะ origin ที่ตั้งใน env `FRONTEND_URL` เท่านั้น พร้อม `credentials: true`
2. **Rate limit** — 1000 requests / 15 นาที ต่อ 1 IP (≈ 1 req/วินาที)
3. `express.json()` — รับ `application/json` (จำกัด 100 kb)
4. `express.urlencoded({ extended: true })`
5. `cookieParser()`
6. Router ของแต่ละโมดูล
7. `errorMiddleware` — แปลง error เป็น JSON

> ⚠️ Native mobile app ไม่ติดปัญหา CORS แต่ถ้าเปิดจาก browser ที่ origin ไม่ตรงกับ `FRONTEND_URL` จะถูกบล็อก

### Response format

**สำเร็จ** — ทุก endpoint มี `"success": true` เสมอ แต่ key ของข้อมูลหลัก **ไม่เหมือนกัน** ต้องเช็คก่อนใช้:

| Key ที่ข้อมูลอยู่                   | ใช้กับ endpoint ไหน                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `data`                              | ส่วนใหญ่ (GET ทั้งหมด, POST/PUT ของ cars, routes, route-points, assignment-driver)      |
| `user`                              | `/auth/login`, `/auth/register`, `/auth/login-with-session`, `PATCH /users/profile/:id` |
| `message` อย่างเดียว (ไม่มี `data`) | ทุก endpoint ที่เป็นการ "ลบ" / ทำ action ไม่คืน entity                                  |
| `success` อย่างเดียว                | `DELETE /assignment-driver/:id` เท่านั้น                                                |

**ผิดพลาด** — ทุก error ใช้รูปแบบเดียวกันเสมอ มีแค่ 2 field:

```json
{
  "success": false,
  "message": "ไม่พบข้อมูลที่ต้องการ"
}
```

**ไม่มี `code` และไม่มี `errors` แยกตาม field** — ถ้าอยากรู้ว่า field ไหนผิด ต้อง parse จากข้อความ `message` เท่านั้น

### รูปแบบ error ของ validation (Zod)

เมื่อ request ไม่ผ่าน schema จะได้ **HTTP 400** พร้อม message ที่รวม error ทุก field มาต่อกันด้วย `, ` เช่น:

```json
{
  "success": false,
  "message": "Invalid input: expected string, received undefined, Invalid input: expected number, received undefined"
}
```

ข้อความที่พบบ่อย:

| ข้อความ                                                | แปลว่า                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `Invalid input: expected string, received undefined`   | ขาด field ที่จำเป็น                                                        |
| `Invalid input: expected date, received string`        | ส่งวันที่มาเป็น string — **ส่งไม่ได้** ดูหัวข้อ [วันที่](#วันที่ส่งไม่ได้) |
| `Invalid UUID`                                         | path param ไม่ใช่ UUID                                                     |
| `Invalid email address`                                | อีเมลรูปแบบผิด                                                             |
| `Too small: expected string to have >=8 characters`    | รหัสผ่านสั้นเกิน 8                                                         |
| `Password ต้องมีอย่างน้อย 8 ตัวอักษร`                  | เหมือนข้างบนแต่เป็นข้อความที่เขียนเองใน `/auth/register`                   |
| `Invalid option: expected one of "active"\|"inactive"` | ค่า enum ไม่ถูกต้อง                                                        |
| `Too big: expected number to be <=90`                  | latitude เกิน 90                                                           |

### Rate limit

```json
{
  "status": 429,
  "error": "คุณส่ง Request ถี่เกินไป กรุณาลองใหม่ในอีก 15 นาที"
}
```

⚠️ **รูปแบบนี้ต่างจาก error ปกติ** — ใช้ `error` ไม่ใช่ `message` และไม่มี `success` ถ้า client อ่าน `message` เฉย ๆ จะได้ `undefined`
Response header มี `RateLimit-*` ให้ client คำนวณเวลาที่เหลือได้

---

## 2. การยืนยันตัวตน (Authentication)

ระบบมี 2 วิธี แยกตามประเภท client

### วิธีที่ 1: Session Cookie — สำหรับ Web / Frontend

Login แล้ว server จะ set cookie ชื่อ `sessionId` ให้อัตโนมัติ

```
sessionId=<uuid>; HttpOnly; SameSite=Lax; Max-Age=604800; Secure (เฉพาะ production)
```

Session data อยู่ใน Redis ที่ key `session:session:{sessionId}` (hash, TTL 7 วัน) เก็บแค่ `{ id, email, role }`

> ⚠️ Cookie เป็น `httpOnly` → **JavaScript อ่านไม่ได้** ต้องพึ่ง browser ส่งให้อัตโนมัติ และต้องตั้ง `credentials: "include"` ใน fetch

**ทดสอบด้วย cURL** (ใช้ cookie jar เก็บ session ไว้ แล้วใช้ซ้ำได้ทุก request ถัดไป)

```bash
# login แล้วบันทึก cookie ไว้ในไฟล์
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@talai.co.th","password":"password123"}'

# request ถัดไปใช้ cookie จากไฟล์เดิม
curl -b cookies.txt http://localhost:3000/auth/login-with-session
```

**ฝั่ง JavaScript (fetch)**

```js
// ตอน login
await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // ← จำเป็นต้องมี
  body: JSON.stringify({ email, password }),
});

// ทุก request หลังจากนั้น
await fetch(`${API}/users/me`, { credentials: "include" });
```

### วิธีที่ 2: Mobile Token — สำหรับ Native Mobile App

ใช้ได้เฉพาะ 5 endpoint แบบ read-only ของรถ/เส้นทาง:

```
GET /cars
GET /cars/live-positions
GET /cars/:id
GET /routes
GET /routes/:id
GET /route-points
GET /route-points/by-route/:routeId
```

```bash
curl http://localhost:3000/cars -H 'x-mobile-token: <MOBILE_ACCESS_TOKEN จาก env>'
```

> ⚠️ เมื่อใช้ Mobile Token ระบบ **จะไม่มี `req.user`** → endpoint ที่ต้องการรู้ role เพื่อกรองข้อมูล (เช่น ซ่อนรถที่ลบแล้ว) จะทำงานแบบ "ไม่มี admin" เสมอ
>
> ⚠️ ถ้าส่ง Mobile Token ผิด → **403** ทันที ไม่ fallback ไปใช้ cookie แต่ถ้าไม่ส่ง header นี้เลย → จะลองใช้ cookie แทน

### สรุปสิ่งที่ client ต้องจำ

| หัวข้อ                    | ค่า                                                                |
| ------------------------- | ------------------------------------------------------------------ |
| ชื่อ cookie               | `sessionId`                                                        |
| ชื่อ header สำหรับ mobile | `x-mobile-token`                                                   |
| อายุ session              | 7 วัน                                                              |
| ที่เก็บ session           | Redis (`session:session:{id}`)                                     |
| ระบบหมดอายุเมื่อ          | Redis ถูกล้าง, server restart ถ้า Redis ไม่ persist, หรือเลย 7 วัน |

---

## 3. สิทธิ์ตามบทบาท (Roles)

enum 4 ค่า: `superadmin` | `admin` | `user` | `driver`

| Role         | ทำอะไรได้                                            |
| ------------ | ---------------------------------------------------- |
| `superadmin` | ทุกอย่าง + จัดการคำเชิญ + ลบ/กู้ผู้ใช้               |
| `admin`      | จัดการรถ, route, route point, shift, ดู log ทั้งหมด  |
| `driver`     | เริ่ม/หยุดงาน, ดูประวัติของตัวเอง                    |
| `user`       | แทบไม่มีอะไรที่จำกัดสิทธิ์ (ดูรายการที่ลบแล้วไม่ได้) |

### ตารางสิทธิ์แบบเต็ม

| Endpoint                                | ไม่ต้อง login |          ทุกคน           | driver | admin | superadmin |
| --------------------------------------- | :-----------: | :----------------------: | :----: | :---: | :--------: |
| `POST /auth/login`                      |      ✅       |                          |        |       |            |
| `POST /auth/register`                   |      ✅       |                          |        |       |            |
| `POST /auth/request-reset-password`     |      ✅       |                          |        |       |            |
| `POST /auth/reset-password`             |      ✅       |                          |        |       |            |
| `GET /auth/logout`                      |               |            ✅            |   ✅   |  ✅   |     ✅     |
| `GET /auth/login-with-session`          |               |            ✅            |   ✅   |  ✅   |     ✅     |
| `GET /users`                            |               |            ✅            |   ✅   |  ✅   |     ✅     |
| `GET /users/me`                         |               |            ✅            |   ✅   |  ✅   |     ✅     |
| `DELETE /users/:id`                     |               |                          |        |       |     ✅     |
| `PATCH /users/restore/:id`              |               |                          |        |       |     ✅     |
| `PATCH /users/profile/:id`              |               |          ✅ ⚠️           | ✅ ⚠️  | ✅ ⚠️ |   ✅ ⚠️    |
| `GET /cars`                             |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `GET /cars/live-positions`              |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `GET /cars/:id`                         |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `POST /cars`                            |               |                          |        |  ✅   |     ✅     |
| `PATCH /cars/:id`                       |               |                          |        |  ✅   |     ✅     |
| `DELETE /cars/:id`                      |               |                          |        |  ✅   |     ✅     |
| `PATCH /cars/restore/:id`               |               |            ⚠️            |   ⚠️   |  ⚠️   |     ✅     |
| `GET /cars/mqtt-credentials/:id`        |               |                          |        |  ✅   |     ✅     |
| `POST /cars/mqtt-credentials/:id/reset` |               |                          |        |  ✅   |     ✅     |
| `GET /routes`                           |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `GET /routes/:id`                       |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `POST /routes`                          |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `PATCH /routes/:id`                     |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `DELETE /routes/:id`                    |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `PATCH /routes/restore/:id`             |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `GET /route-points`                     |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `GET /route-points/by-route/:routeId`   |               | ทุกคน (รวม mobile token) |   ✅   |  ✅   |     ✅     |
| `POST /route-points`                    |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `PATCH /route-points/:id`               |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `DELETE /route-points/:id`              |               |            ⚠️            |   ⚠️   |  ⚠️   |     ⚠️     |
| `GET /admin-invites`                    |               |                          |        |       |     ✅     |
| `POST /admin-invites`                   |               |                          |        |       |     ✅     |
| `DELETE /admin-invites/:email`          |               |                          |        |       |     ✅     |
| `GET /car-history-logs/by-car/:carId`   |               |            ✅            |   ✅   |  ✅   |     ✅     |
| `GET /assignment-driver`                |               |                          |        |  ✅   |     ✅     |
| `GET /assignment-driver/:id`            |               |                          |   ✅   |  ✅   |     ✅     |
| `GET /assignment-driver/driver/:id`     |               |                          |   ✅   |  ✅   |     ✅     |
| `POST /assignment-driver`               |               |                          |        |  ✅   |     ✅     |
| `PUT /assignment-driver/:id`            |               |                          |        |  ✅   |     ✅     |
| `DELETE /assignment-driver/:id`         |               |                          |        |  ✅   |     ✅     |
| `POST /driving-logs/start`              |               |                          |   ✅   |       |            |
| `POST /driving-logs/end`                |               |                          |   ✅   |       |            |
| `GET /driving-logs/current`             |               |                          |   ✅   |       |            |
| `GET /driving-logs/my`                  |               |                          |   ✅   |  ✅   |     ✅     |
| `GET /driving-logs`                     |               |                          |        |  ✅   |     ✅     |

**หมายเหตุสำคัญ**

- ⚠️ = **ผ่านแค่ session ไม่เช็ค role เลย** — user ธรรมดาที่ login แล้วก็เรียกได้ ดูรายละเอียดใน [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)
- Mobile app (Mobile Token) เข้าถึงได้เฉพาะ 7 endpoint ของ `cars` / `routes` / `route-points` ที่เป็น GET
- การเช็ค role ทั้งหมดเขียน **inline ใน controller** ไม่มี middleware กลาง → ต้องอ่านโค้ดเพื่อรู้ว่า endpoint ไหนเช็คอะไร

### การดูข้อมูลที่ถูก soft delete

`users`, `cars`, `routes` ใช้ soft delete (ตั้ง `deletedAt`) ไม่ลบจริง

- `admin` / `superadmin` → เห็นข้อมูลที่ถูกลบแล้วทั้งหมด
- ทุก role อื่น + mobile token → เห็นเฉพาะที่ยังไม่ถูกลบ

---

## 4. Workflow ที่ต้องเรียกตามลำดับ

### 4.1 เตรียมระบบครั้งแรก (superadmin)

```
1. POST /auth/register           ← ต้องมีคำเชิญก่อน (ดู 4.2) ถ้าเป็นระบบใหม่ที่ไม่มี user เลย ต้อง insert เข้า DB โดยตรง
2. POST /auth/login
3. POST /admin-invites           ← เชิญ admin/driver คนอื่น (ส่ง invite code ให้ทางอีเมล)
```

### 4.2 เพิ่มผู้ใช้ใหม่

```
1. superadmin: POST   /admin-invites     { email, role }     → ระบบส่ง inviteCode ไปทางอีเมล
2. ผู้ถูกเชิญ: POST   /auth/register    { email, password, inviteCode }
                                                          → login สำเร็จอัตโนมัติ ได้ cookie มาเลย
```

⚠️ `inviteCode` ถูก**ลบทิ้งจาก Redis ทันที** หลัง register สำเร็จ ใช้ซ้ำไม่ได้
⚠️ **role ที่ผู้ใช้ได้ มาจากคำเชิญ ไม่ใช่จาก body** — ส่ง `role` ใน body ไปก็ถูก override ทิ้ง

### 4.3 สร้างเส้นทางและรถ

```
1. POST   /routes           { name: "สาย 1 เชียงใหม่-ภูเก็ต" }   → ได้ routeId
2. POST   /route-points     [ จุดที่ 1, จุดที่ 2, ... ]          → ใส่จุดบนเส้นทาง (ส่งเป็น array ได้)
3. POST   /cars             { routeId, carNumber }              → ได้ carId + ระบบสร้าง MQTT credential ให้
4. GET    /cars/mqtt-credentials/:carId                         → เอา credential ไปใส่รถ
```

### 4.4 คนขับทำงาน

```
1. admin:    POST /assignment-driver   { carId, driverId, startTime, endTime }  → ได้ shiftId
2. driver:   POST /driving-logs/start  { shiftId }                             → ได้ logId
   ── ขับรถไปเรื่อย ๆ ตำแหน่งเข้ามาทาง MQTT → Redis → WebSocket ──
3. driver:   POST /driving-logs/end    { logId }                               → จบงาน
```

> ⚠️ ถ้ารถวิ่งแต่ driver ยังไม่ได้กด start → ระบบจะ broadcast alert ทาง WebSocket (ดู `REALTIME.md`)
> ⚠️ ระบบอนุญาตให้มี driving log ที่ `status: "active"` ได้**แค่ 1 อันทั้งระบบ** ไม่ใช่ต่อคน

### 4.5 ดูตำแหน่งรถ (Frontend แผนที่)

```
1. GET /cars                    → รายการรถทั้งหมด
2. GET /cars/live-positions     → ตำแหน่งล่าสุดทุกคัน (initial state ตอนเปิดแผนที่)
3. เปิด WebSocket ws://host:3000/
                            → รับ location update ต่อเนื่องไปเรื่อย ๆ
```

---

## 5. Reference ทุก Endpoint

### 5.1 Auth — `/auth`

#### `POST /auth/login`

เข้าสู่ระบบ — ไม่ต้องมี auth

**Request**

| Field      | Type   | Required | หมายเหตุ                |
| ---------- | ------ | :------: | ----------------------- |
| `email`    | string |    ✅    | ต้องเป็นอีเมลที่ถูกต้อง |
| `password` | string |    ✅    | ยาว ≥ 8 ตัวอักษร        |

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@talai.co.th",
    "password": "password123"
  }'
```

**Response `200`**

```json
{
  "success": true,
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "email": "admin@talai.co.th",
    "role": "admin",
    "deletedAt": null,
    "createdAt": "2025-01-15T03:00:00.000Z",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "profileImageUrl": null,
    "phoneNumber": "0812345678"
  }
}
```

> 🔑 Response มี header `Set-Cookie: sessionId=...` — browser จะเก็บให้อัตโนมัติ

**Errors**

| Code  | message                                       |
| ----- | --------------------------------------------- |
| `400` | Zod error เช่น `Invalid email address`        |
| `400` | `อีเมลหรือรหัสผ่านไม่ถูกต้อง` (รหัสผ่านผิด)   |
| `401` | `บัญชีของคุณถูกระงับหรือถูกลบแล้ว`            |
| `404` | `อีเมลหรือรหัสผ่านไม่ถูกต้อง` (ไม่พบอีเมลนี้) |

---

#### `POST /auth/register`

สมัครสมาชิกใหม่ — ไม่ต้องมี auth แต่ **ต้องมีคำเชิญที่ยัง `pending`**

**Request**

| Field             | Type           | Required | หมายเหตุ                                               |
| ----------------- | -------------- | :------: | ------------------------------------------------------ |
| `email`           | string         |    ✅    | ⚠️ **ไม่ validate รูปแบบอีเมล** (ผิดจาก `/login`)      |
| `password`        | string         |    ✅    | ≥ 8 ตัวอักษร                                           |
| `inviteCode`      | string         |    ✅    | ได้จากอีเมลคำเชิญ ใช้ได้ครั้งเดียว                     |
| `firstName`       | string \| null |          |                                                        |
| `lastName`        | string \| null |          |                                                        |
| `phoneNumber`     | string \| null |          |                                                        |
| `profileImageUrl` | string \| null |          |                                                        |
| `role`            | enum           |          | ⚠️ **ถูก ignore** — ใช้ role จากคำเชิญแทน              |
| `id`              | uuid           |          | ⚠️ ส่งมาได้ ระบบจะใช้ค่านี้แทนการ generate             |
| `createdAt`       | string         |          | ⚠️ ส่งมาได้แต่ต้องเป็นรูปแบบที่ `new Date()` parse ได้ |
| `deletedAt`       | string         |          | ⚠️ ส่งมาได้ → สร้าง user ที่ถูกระงับทันที              |

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "driver1@talai.co.th",
    "password": "password123",
    "inviteCode": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "firstName": "สมชาย",
    "lastName": "ขับรถ",
    "phoneNumber": "0812345678"
  }'
```

**Response `201`** — เหมือน `/login` แต่ลำดับ field ต่างกันเล็กน้อย (`deletedAt` มาก่อน `role`)

```json
{
  "success": true,
  "user": {
    "id": "33333333-3333-4333-8333-333333333333",
    "email": "driver1@talai.co.th",
    "deletedAt": null,
    "role": "driver",
    "createdAt": "2025-01-16T04:00:00.000Z",
    "firstName": "สมชาย",
    "lastName": "ขับรถ",
    "profileImageUrl": null,
    "phoneNumber": "0812345678"
  }
}
```

**Errors**

| Code  | message                                                           |
| ----- | ----------------------------------------------------------------- |
| `400` | `คุณไม่ได้รับอนุญาตจากผู้ดูแลระบบ` — ไม่มีรายการคำเชิญของอีเมลนี้ |
| `400` | `รหัสเชิญนี้ถูกใช้งานหรือยกเลิกไปแล้ว` — status ไม่ใช่ `pending`  |
| `400` | `รหัสเชิญไม่ถูกต้องหรือหมดอายุ` — inviteCode ไม่ตรง               |
| `400` | `อีเมลนี้ถูกลงทะเบียนในระบบแล้ว`                                  |

---

#### `GET /auth/logout`

ออกจากระบบ — ต้องมี session

> ⚠️ ใช้ **GET** ไม่ใช่ POST

```bash
curl -b cookies.txt http://localhost:3000/auth/logout
```

**Response `200`**

```json
{ "success": true, "message": "Logged out" }
```

---

#### `GET /auth/login-with-session`

ดึงข้อมูล user ปัจจุบันจาก session (ไม่ต้อง login ใหม่) — ใช้ตอนเปิดหน้าเว็บใหม่เพื่อเช็คว่ายังล็อกอินอยู่ไหม

```bash
curl -b cookies.txt http://localhost:3000/auth/login-with-session
```

**Response `200`** — โครงสร้างเดียวกับ `/login` (ส่งคืนข้อมูลล่าสุดจาก DB, `deletedAt` เป็น `null` เสมอเพราะเช็คแล้วว่าไม่ถูกลบ)

**Errors** ทั้งหมด `401`

| message                                                            |
| ------------------------------------------------------------------ |
| `กรุณาเข้าสู่ระบบก่อนใช้งาน` — ไม่มี cookie                        |
| `เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่` — Redis ไม่มี session นี้     |
| `ไม่พบข้อมูลผู้ใช้งานในระบบ` — session ยังอยู่แต่ user ถูกลบจาก DB |
| `ผู้ใช้งานถูกระงับ หรือ ถูกลบ`                                     |

---

#### `POST /auth/request-reset-password`

ขอลิงก์รีเซ็ตรหัสผ่าน (ส่งอีเมล) — ไม่ต้องมี auth

**Request**

| Field   | Type   | Required |
| ------- | ------ | :------: |
| `email` | string |    ✅    |

```bash
curl -X POST http://localhost:3000/auth/request-reset-password \
  -H 'Content-Type: application/json' \
  -d '{ "email": "admin@talai.co.th" }'
```

**Response `200`**

```json
{
  "success": true,
  "message": "ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว"
}
```

**Errors** — `404` `ไม่พบผู้ใช้งานที่มีอีเมลนี้`

**สิ่งที่เกิดขึ้นเบื้องหลัง**

- token ยาว 64 ตัว (random 32 bytes → hex) เก็บใน Redis key `session:resetpassword:{token}` TTL 15 นาที
- ส่งอีเมลลิงก์ `{FRONTEND_URL}/auth/reset-password?token={token}`

---

#### `POST /auth/reset-password`

ตั้งรหัสผ่านใหม่ — ไม่ต้องมี auth

**Request**

| Field         | Type   | Required | หมายเหตุ                    |
| ------------- | ------ | :------: | --------------------------- |
| `token`       | string |    ✅    | token จากลิงก์ในอีเมล       |
| `newPassword` | string |    ✅    | ⚠️ **ไม่ validate ความยาว** |

```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0",
    "newPassword": "newpassword123"
  }'
```

**Response `200`**

```json
{ "success": true, "message": "รีเซ็ตรหัสผ่านสำเร็จ" }
```

**Errors**

| Code  | message                      | หมายเหตุ                                                  |
| ----- | ---------------------------- | --------------------------------------------------------- |
| `404` | `โทเคนไม่ถูกต้องหรือหมดอายุ` | token หมดอายุ/ใช้ไปแล้ว/ไม่มีใน Redis                     |
| `500` | _(ข้อความจาก bcrypt)_        | ⚠️ ถ้าไม่ส่ง `newPassword` หรือส่งค่าที่ bcrypt รับไม่ได้ |

> ⚠️ หลัง reset สำเร็จ **session เดิมยังใช้ได้อยู่** ระบบไม่ได้ revoke session

---

### 5.2 Users — `/users`

> ทุก endpoint ในโมดูลนี้ต้องมี session

#### `GET /users`

ดึงผู้ใช้ทั้งหมด — ไม่เช็ค role (ใคร login แล้วก็เรียกได้)

```bash
curl -b cookies.txt http://localhost:3000/users
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "email": "admin@talai.co.th",
      "hashPassword": "$2b$10$abcdefghijklmnopqrstuv",
      "role": "admin",
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "profileImageUrl": null,
      "phoneNumber": "0812345678",
      "createdAt": "2025-01-15T03:00:00.000Z",
      "deletedAt": null
    }
  ]
}
```

---

#### `GET /users/me`

ข้อมูลของตัวเอง

```bash
curl -b cookies.txt http://localhost:3000/users/me
```

**Response `200`** — `data` เป็น object เดียว (ไม่ใช่ array) มี `hashPassword` เหมือนกัน

```json
{
  "success": true,
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "email": "admin@talai.co.th",
    "hashPassword": "$2b$10$abcdefghijklmnopqrstuv",
    "role": "admin",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "profileImageUrl": null,
    "phoneNumber": "0812345678",
    "createdAt": "2025-01-15T03:00:00.000Z",
    "deletedAt": null
  }
}
```

---

#### `DELETE /users/:id` 🔒 superadmin

ลบผู้ใช้ (soft delete — ตั้ง `deletedAt`)

| Param | Type   | Required | หมายเหตุ                                              |
| ----- | ------ | :------: | ----------------------------------------------------- |
| `id`  | string |    ✅    | ⚠️ validate แค่ความยาว ≥ 1 **ไม่ได้เช็คว่าเป็น UUID** |

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/users/33333333-3333-4333-8333-333333333333
```

**Response `200`**

```json
{ "success": true, "message": "ลบผู้ใช้เรียบร้อยแล้ว" }
```

**Errors**

| Code  | message                                 |
| ----- | --------------------------------------- |
| `403` | `เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้` |
| `404` | `User not found`                        |

---

#### `PATCH /users/restore/:id` 🔒 superadmin

กู้คืนผู้ใช้ที่ถูกลบ

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/users/restore/33333333-3333-4333-8333-333333333333
```

**Response `200`**

```json
{ "success": true, "message": "ยกเลิกการลบผู้ใช้" }
```

**Errors** — `403` `เฉพาะ superadmin ที่สามารถลบผู้ใช้ได้`

---

#### `PATCH /users/profile/:id` — อัปโหลดไฟล์

แก้ไข profile (ชื่อ เบอร์โทร รูปภาพ) — ต้องมี session **แต่ไม่เช็คว่าเป็น profile ของตัวเอง**

**Content-Type:** `multipart/form-data`

**Form field**

| Field          | Type   | Required | หมายเหตุ                                        |
| -------------- | ------ | :------: | ----------------------------------------------- |
| `profileImage` | file   |          | ⚠️ **ชื่อ field ต้องเป๊ะ** ชื่ออื่น → error 500 |
| `firstName`    | string |          | ไม่มี validation                                |
| `lastName`     | string |          | ไม่มี validation                                |
| `phoneNumber`  | string |          | ไม่มี validation                                |

> ส่งเฉพาะไฟล์ หรือส่งเฉพาะ text field ก็ได้ อย่างน้อยต้องมีอย่างหนึ่ง

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/users/profile/22222222-2222-4222-8222-222222222222 \
  -F 'firstName=สมชาย' \
  -F 'lastName=ใจดีใหม่' \
  -F 'phoneNumber=0899999999' \
  -F 'profileImage=@avatar.jpg'
```

**Response `200`** — อยู่ใต้ key `user` (ไม่ใช่ `data`)

```json
{
  "success": true,
  "user": {
    "id": "22222222-2222-4222-8222-222222222222",
    "email": "admin@talai.co.th",
    "hashPassword": "$2b$10$abcdefghijklmnopqrstuv",
    "role": "admin",
    "firstName": "สมชาย",
    "lastName": "ใจดีใหม่",
    "profileImageUrl": "https://storage.example.com/object/public/kukps-talai-avatar/22222222-2222-4222-8222-222222222222-profile-1737000000000.jpg",
    "phoneNumber": "0899999999",
    "createdAt": "2025-01-15T03:00:00.000Z",
    "deletedAt": null
  }
}
```

**ข้อมูลรูปภาพ**

| หัวข้อ   | ค่า                                |
| -------- | ---------------------------------- |
| ที่เก็บ  | S3-compatible storage              |
| Bucket   | `kukps-talai-avatar`               |
| ชื่อไฟล์ | `{userId}-profile-{timestamp}.jpg` |
| ข้อจำกัด | ไม่มีจำกัดขนาดไฟล์และชนิดไฟล์      |

**Errors**

| Code  | message       | หมายเหตุ                                    |
| ----- | ------------- | ------------------------------------------- |
| `404` | `ไม่พบผู้ใช้` | ไม่พบ user **หรือไม่ได้ส่งข้อมูลอะไรมาเลย** |

---

### 5.3 Cars — `/cars`

> GET 3 ตัวแรกรับได้ทั้ง session และ `x-mobile-token` — ที่เหลือต้องใช้ session

#### `GET /cars`

ดึงรถทั้งหมด

```bash
# แบบ session
curl -b cookies.txt http://localhost:3000/cars

# แบบ mobile app
curl http://localhost:3000/cars -H 'x-mobile-token: <token>'
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "c0000000-0000-4000-8000-000000000001",
      "createdAt": "2025-01-15T03:00:00.000Z",
      "routeId": "a0000000-0000-4000-8000-000000000001",
      "updatedBy": "22222222-2222-4222-8222-222222222222",
      "updatedAt": "2025-01-15T03:00:00.000Z",
      "carMqttUsername": "car_a1b2c3d4e5f6",
      "carNumber": "กรุงเทพ-001",
      "status": "inactive",
      "deletedAt": null
    }
  ]
}
```

> `encryptedMqttPassword` ถูกตัดออกเสมอ — แต่ `carMqttUsername` **ยังถูกส่งมา**

---

#### `GET /cars/live-positions`

ตำแหน่งล่าสุดของทุกรถ (อ่านจาก Redis) — ใช้เป็น initial state ตอนเปิดแผนที่

```bash
curl -b cookies.txt http://localhost:3000/cars/live-positions
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "type": "location",
      "carId": "c0000000-0000-4000-8000-000000000001",
      "lat": 18.7883,
      "lng": 98.9853,
      "status": "active",
      "createdAt": "2025-01-16T04:30:00.000Z"
    }
  ]
}
```

**พฤติกรรม**

- รถที่ถูก soft delete จะถูกกรองออก
- ถ้ารถไม่มีข้อมูลใน Redis (เช่น server เพิ่ง restart) → ระบบไปดึงจาก `car_history_log` ล่าสุดใน DB มาแทน โดยบังคับ `status: "inactive"`
- ⚠️ **`lat` / `lng` อาจได้เป็น string** เพราะ Redis hash คืนค่าเป็น string แม้ TypeScript จะประกาศเป็น `number` — ต้อง `Number()` ก่อนใช้กับแผนที่

---

#### `GET /cars/:id`

**Path** — `id` (uuid)

```bash
curl -b cookies.txt http://localhost:3000/cars/c0000000-0000-4000-8000-000000000001
```

**Response `200`** — object เดียว เหมือนสมาชิกใน `GET /cars`

**Errors** — `404` `ไม่พบข้อมูลรถ` (ไม่พบ หรือเป็นรถที่ถูกลบแล้วและผู้เรียกไม่ใช่ admin)

---

#### `POST /cars` 🔒 admin, superadmin

สร้างรถใหม่ — ระบบจะ generate MQTT credentials ให้อัตโนมัติ

**Request**

| Field       | Type   | Required | หมายเหตุ                                                                      |
| ----------- | ------ | :------: | ----------------------------------------------------------------------------- |
| `routeId`   | string |    ✅    | ⚠️ validate แค่ว่าเป็น string **ไม่เช็ค UUID** และไม่เช็คว่ามี route นั้นจริง |
| `carNumber` | string |    ✅    | ⚠️ ต้อง **unique** ในระบบ (ซ้ำจะได้ 500)                                      |

```bash
curl -X POST -b cookies.txt http://localhost:3000/cars \
  -H 'Content-Type: application/json' \
  -d '{
    "routeId": "a0000000-0000-4000-8000-000000000001",
    "carNumber": "กรุงเทพ-001"
  }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "c0000000-0000-4000-8000-000000000001",
    "createdAt": "2025-01-15T03:00:00.000Z",
    "routeId": "a0000000-0000-4000-8000-000000000001",
    "updatedBy": "22222222-2222-4222-8222-222222222222",
    "updatedAt": "2025-01-15T03:00:00.000Z",
    "carNumber": "กรุงเทพ-001",
    "status": "inactive",
    "deletedAt": null
  }
}
```

> ⚠️ Response นี้ **ไม่มี `carMqttUsername`** (ตัดออก) — ต้องเรียก `GET /cars/mqtt-credentials/:id` เพื่อเอาไปใส่รถ

**Errors**

| Code  | message                                                 |
| ----- | ------------------------------------------------------- |
| `403` | `ไม่มีสิทธิ์ในการสร้างข้อมูลรถ`                         |
| `400` | Zod error                                               |
| `500` | ⚠️ `carNumber` ซ้ำ หรือ env `ENCRYPTION_KEY` ไม่ได้ตั้ง |

---

#### `PATCH /cars/:id` 🔒 admin, superadmin

แก้ไขข้อมูลรถ

**Path** — `id` (uuid)
**Body** — ⚠️ **ทั้ง 4 field บังคับต้องส่ง** แม้ `status` จะไม่เปลี่ยนก็ต้องส่งมา

| Field       | Type                       | Required | หมายเหตุ                                                                  |
| ----------- | -------------------------- | :------: | ------------------------------------------------------------------------- |
| `id`        | string                     |    ✅    | ⚠️ **validate แต่ไม่ได้ใช้** — path param ตัวนี้ถูกใช้จริง ส่งค่าไหนก็ได้ |
| `routeId`   | string                     |    ✅    |                                                                           |
| `carNumber` | string                     |    ✅    |                                                                           |
| `status`    | `"active"` \| `"inactive"` |    ✅    | ⚠️ ปกติระบบจะเป็นคนอัปเดต status เองจาก MQTT ไม่ควรส่งเอง                 |

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/cars/c0000000-0000-4000-8000-000000000001 \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "c0000000-0000-4000-8000-000000000001",
    "routeId": "a0000000-0000-4000-8000-000000000002",
    "carNumber": "กรุงเทพ-001",
    "status": "inactive"
  }'
```

**Response `200`** — เหมือน `POST /cars`

**Errors**

| Code  | message                         |
| ----- | ------------------------------- |
| `403` | `ไม่มีสิทธิ์ในการแก้ไขข้อมูลรถ` |
| `404` | `ไม่พบข้อมูลรถในระบบ`           |

---

#### `DELETE /cars/:id` 🔒 admin, superadmin

ลบรถ (soft delete)

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/cars/c0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{ "success": true, "message": "ลบข้อมูลรถสำเร็จ" }
```

**Errors** — `403` `ไม่มีสิทธิ์ในการลบข้อมูลรถ`

> ไม่มี 404 — ถ้า id ไม่มีอยู่ก็ยังตอบ 200

---

#### `PATCH /cars/restore/:id` ⚠️ ไม่เช็ค role

กู้คืนรถที่ถูกลบ

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/cars/restore/c0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{ "success": true, "message": "ยกเลิกการลบข้อมูลรถสำเร็จ" }
```

---

#### `GET /cars/mqtt-credentials/:id` 🔒 admin, superadmin

ดึง MQTT credentials ของรถ (ถอดรหัส password)

```bash
curl -b cookies.txt \
  http://localhost:3000/cars/mqtt-credentials/c0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "carMqttUsername": "car_a1b2c3d4e5f6",
    "decryptedMqttPassword": "9f8e7d6c5b4a39281706f5e4d3c2b1a0"
  }
}
```

**Errors**

| Code  | message                                                     |
| ----- | ----------------------------------------------------------- |
| `403` | `ไม่มีสิทธิ์ในการดึงข้อมูล MQTT`                            |
| `404` | `ไม่พบข้อมูลรถในระบบ`                                       |
| `500` | ⚠️ `ENCRYPTION_KEY is not defined in environment variables` |

---

#### `POST /cars/mqtt-credentials/:id/reset` 🔒 admin, superadmin

สร้าง MQTT credentials ใหม่ (รหัสผ่านเดิมใช้ไม่ได้อีกต่อไป)

```bash
curl -X POST -b cookies.txt \
  http://localhost:3000/cars/mqtt-credentials/c0000000-0000-4000-8000-000000000001/reset
```

**Response `200`**

```json
{ "success": true, "message": "รีเซ็ตรหัสผ่าน MQTT สำเร็จ" }
```

> ⚠️ **credential ใหม่ไม่ถูกส่งกลับมา** — ต้องเรียก `GET /cars/mqtt-credentials/:id` ต่อทันที

---

### 5.4 Routes — `/routes`

#### `GET /routes`

ดึงเส้นทางทั้งหมด

```bash
curl -b cookies.txt http://localhost:3000/routes
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "a0000000-0000-4000-8000-000000000001",
      "createdAt": "2025-01-15T03:00:00.000Z",
      "name": "สาย 1 เชียงใหม่-ภูเก็ต",
      "updatedBy": "22222222-2222-4222-8222-222222222222",
      "updatedAt": "2025-01-15T03:00:00.000Z",
      "deletedAt": null
    }
  ]
}
```

---

#### `GET /routes/:id`

**Path** — `id` (uuid)

```bash
curl -b cookies.txt http://localhost:3000/routes/a0000000-0000-4000-8000-000000000001
```

**Response `200`** — object เดียว

**Errors** — `404` `Route not found`

---

#### `POST /routes` ⚠️ ไม่เช็ค role

สร้างเส้นทางใหม่

**Request**

| Field       | Type         | Required | หมายเหตุ                                   |
| ----------- | ------------ | :------: | ------------------------------------------ |
| `name`      | string       |    ✅    | ชื่อเส้นทาง                                |
| `id`        | uuid         |          | ถ้าไม่ส่งระบบ generate ให้                 |
| `updatedBy` | uuid \| null |          | ⚠️ **ถูก override ด้วย id ของคนที่ login** |
| `createdAt` | Date         |          | ⚠️ ดู [วันที่ส่งไม่ได้](#วันที่ส่งไม่ได้)  |
| `updatedAt` | Date         |          | ⚠️ ดู [วันที่ส่งไม่ได้](#วันที่ส่งไม่ได้)  |
| `deletedAt` | Date \| null |          | ⚠️ ส่งมาได้ ทำให้สร้างเส้นทางที่ถูกลบทันที |

```bash
curl -X POST -b cookies.txt http://localhost:3000/routes \
  -H 'Content-Type: application/json' \
  -d '{ "name": "สาย 1 เชียงใหม่-ภูเก็ต" }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "a0000000-0000-4000-8000-000000000001",
    "createdAt": "2025-01-15T03:00:00.000Z",
    "name": "สาย 1 เชียงใหม่-ภูเก็ต",
    "updatedBy": "22222222-2222-4222-8222-222222222222",
    "updatedAt": "2025-01-15T03:00:00.000Z",
    "deletedAt": null
  }
}
```

**Errors** — `400` Zod error

---

#### `PATCH /routes/:id` ⚠️ ไม่เช็ค role

แก้ไขเส้นทาง — ทุก field เป็น optional

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/routes/a0000000-0000-4000-8000-000000000001 \
  -H 'Content-Type: application/json' \
  -d '{ "name": "สาย 1 เชียงใหม่-ภูเก็ต (ปรับปรุง)" }'
```

**Response `200`** — เหมือน `POST /routes`

**Errors**

| Code  | message                    |
| ----- | -------------------------- |
| `404` | `ไม่พบข้อมูลเส้นทางในระบบ` |
| `400` | Zod error                  |

---

#### `DELETE /routes/:id` ⚠️ ไม่เช็ค role

ลบเส้นทาง (soft delete)

> ⚠️ **side effect:** ระบบจะตั้ง `routeId = null` ให้รถทุกคันที่ผูกกับเส้นทางนี้

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/routes/a0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{ "success": true, "message": "ลบสายการเดินรถสำเร็จ" }
```

---

#### `PATCH /routes/restore/:id` ⚠️ ไม่เช็ค role

กู้คืนเส้นทาง

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/routes/restore/a0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{ "success": true, "message": "ยกเลิกการลบสายรถ" }
```

---

### 5.5 Route Points — `/route-points`

#### `GET /route-points`

จุดทั้งหมดของทุกเส้นทาง เรียงตาม `sequence` จากน้อยไปมาก

```bash
curl -b cookies.txt http://localhost:3000/route-points
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "d0000000-0000-4000-8000-000000000001",
      "routeId": "a0000000-0000-4000-8000-000000000001",
      "sequence": 10000,
      "lat": 18.7883,
      "lng": 98.9853,
      "name": "หน้าสถานีขนส่งอนุภัย",
      "timeToNextSecs": 300
    }
  ]
}
```

---

#### `GET /route-points/by-route/:routeId`

จุดของเส้นทางเดียว

**Path** — `routeId` (uuid)

```bash
curl -b cookies.txt \
  http://localhost:3000/route-points/by-route/a0000000-0000-4000-8000-000000000001
```

**Response `200`** — array เหมือนข้างบน

---

#### `POST /route-points` ⚠️ ไม่เช็ค role

เพิ่มจุด — **รองรับทั้ง object เดียว และ array** (ส่งทีเดียวหลายจุดได้)

**Request** — object เดียว หรือ array ของ object

| Field            | Type           | Required | หมายเหตุ                                                     |
| ---------------- | -------------- | :------: | ------------------------------------------------------------ |
| `routeId`        | uuid           |    ✅    | ต้องมีเส้นทางนี้จริง                                         |
| `sequence`       | integer        |    ✅    | ⚠️ ต้องมากกว่า 0 — ใช้เว้นระยะ 10000 เพื่อแทรกจุดกลางได้ง่าย |
| `lat`            | number         |    ✅    | −90 … 90                                                     |
| `lng`            | number         |    ✅    | −180 … 180                                                   |
| `name`           | string \| null |          |                                                              |
| `timeToNextSecs` | integer ≥ 0    |          | เวลา (วินาที) ถึงจุดถัดไป                                    |
| `id`             | uuid           |          | ถ้าไม่ส่งระบบ generate                                       |

**แนวทาง `sequence`**

ให้เว้นระยะเป็นหลักพัน เช่น จุดแรก `10000` จุดถัดไป `20000` ถ้าต้องการแทรกจุดใหม่ตรงกลาง → ใช้ `(10000 + 20000) / 2 = 15000`

**ส่งทีเดียวหลายจุด (แนะนำ)**

```bash
curl -X POST -b cookies.txt http://localhost:3000/route-points \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "routeId": "a0000000-0000-4000-8000-000000000001",
      "sequence": 10000,
      "lat": 18.7883,
      "lng": 98.9853,
      "name": "หน้าสถานีขนส่งอนุภัย",
      "timeToNextSecs": 600
    },
    {
      "routeId": "a0000000-0000-4000-8000-000000000001",
      "sequence": 20000,
      "lat": 18.7995,
      "lng": 98.9793,
      "name": "หน้ามหาวิทยาลัยเชียงใหม่",
      "timeToNextSecs": null
    }
  ]'
```

**Response `201`** — ⚠️ **ไม่คืนข้อมูลที่สร้าง** มีแค่ message

```json
{ "success": true, "message": "เพิ่มจุดจอดสำเร็จ" }
```

> ถ้าอยากรู้ id ของจุดที่สร้าง ต้องเรียก `GET /route-points/by-route/:routeId` ตามหลัง

**Errors** — `400` Zod error (รวมทุก field ที่ผิดไว้ใน message เดียว)

---

#### `PATCH /route-points/:id` ⚠️ ไม่เช็ค role

แก้ไขจุด — ทุก field เป็น optional

```bash
curl -X PATCH -b cookies.txt \
  http://localhost:3000/route-points/d0000000-0000-4000-8000-000000000001 \
  -H 'Content-Type: application/json' \
  -d '{ "name": "หน้าสถานีขนส่งอนุภัย (ใหม่)", "timeToNextSecs": 450 }'
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "d0000000-0000-4000-8000-000000000001",
    "routeId": "a0000000-0000-4000-8000-000000000001",
    "sequence": 10000,
    "lat": 18.7883,
    "lng": 98.9853,
    "name": "หน้าสถานีขนส่งอนุภัย (ใหม่)",
    "timeToNextSecs": 450
  }
}
```

**Errors** — `404` `ไม่พบข้อมูลจุดบนเส้นทางในระบบ`

---

#### `DELETE /route-points/:id` ⚠️ ไม่เช็ค role

ลบจุด (**ลบจริง ไม่ใช่ soft delete**)

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/route-points/d0000000-0000-4000-8000-000000000001
```

**Response `200`**

```json
{ "success": true, "message": "ลบจุดจอดสำเร็จ" }
```

---

### 5.6 Admin Invites — `/admin-invites`

> 🔒 ทุก endpoint ในโมดูลนี้ **superadmin เท่านั้น**

#### `GET /admin-invites`

ดูรายการคำเชิญทั้งหมด

```bash
curl -b cookies.txt http://localhost:3000/admin-invites
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "email": "driver1@talai.co.th",
      "addedBy": "11111111-1111-4111-8111-111111111111",
      "status": "pending",
      "createdAt": "2025-01-16T02:00:00.000Z",
      "role": "driver"
    }
  ]
}
```

**Errors** — `403` `ไม่มีสิทธิ์ในการดูรายการคำเชิญ`

---

#### `POST /admin-invites`

เพิ่มคำเชิญ — ระบบส่ง invite code ไปทางอีเมล

**Request**

| Field   | Type                                      | Required | หมายเหตุ                                     |
| ------- | ----------------------------------------- | :------: | -------------------------------------------- |
| `email` | string                                    |    ✅    | ต้องเป็นอีเมลที่ถูกต้อง                      |
| `role`  | `"superadmin"` \| `"admin"` \| `"driver"` |    ✅    | role ที่ผู้ถูกเชิญจะได้ ⚠️ ส่ง `user` ไม่ได้ |

```bash
curl -X POST -b cookies.txt http://localhost:3000/admin-invites \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "driver1@talai.co.th",
    "role": "driver"
  }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "email": "driver1@talai.co.th",
    "addedBy": "11111111-1111-4111-8111-111111111111",
    "status": "pending",
    "createdAt": "2025-01-16T02:00:00.000Z",
    "role": "driver"
  }
}
```

> ⚠️ **`inviteCode` ไม่ถูกส่งคืนใน response** — ไปหาจากอีเมลที่ระบบส่งไป

**Errors**

| Code  | message                                  |
| ----- | ---------------------------------------- |
| `403` | `ไม่มีสิทธิ์ในการเพิ่มคำเชิญ`            |
| `400` | `รูปแบบอีเมลไม่ถูกต้อง` / Zod error อื่น |

---

#### `DELETE /admin-invites/:email`

ยกเลิกคำเชิญ (ลบจริง)

**Path** — `email` (ต้อง validate เป็นอีเมล)

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/admin-invites/driver1@talai.co.th
```

**Response `200`**

```json
{ "success": true, "message": "ยกเลิกคำเชิญเรียบร้อยแล้ว" }
```

**Errors**

| Code  | message                                                                        |
| ----- | ------------------------------------------------------------------------------ |
| `403` | `ไม่มีสิทธิ์ในการยกเลิกคำเชิญ`                                                 |
| `400` | `รูปแบบอีเมลไม่ถูกต้อง`                                                        |
| `404` | `ไม่พบรายการคำเชิญนี้ในระบบ`                                                   |
| `400` | `ไม่สามารถยกเลิกคำเชิญที่ไม่ได้อยู่ในสถานะรอยืนยันได้` — สถานะไม่ใช่ `pending` |

---

### 5.7 Car History Logs — `/car-history-logs`

#### `GET /car-history-logs/by-car/:carId`

ประวัติตำแหน่งของรถ — เรียงจากใหม่ไปเก่า

**Path** — `carId` (uuid)
**Query**

| Param   | Type    | Default | หมายเหตุ |
| ------- | ------- | ------- | -------- |
| `limit` | integer | `50`    | ต้อง ≥ 1 |

```bash
curl -b cookies.txt \
  'http://localhost:3000/car-history-logs/by-car/c0000000-0000-4000-8000-000000000001?limit=100'
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "b0000000-0000-4000-8000-000000000001",
      "createdAt": "2025-01-16T04:30:00.000Z",
      "carId": "c0000000-0000-4000-8000-000000000001",
      "lat": 18.7883,
      "lng": 98.9853
    }
  ]
}
```

**Errors** — `400` Zod error (เช่น `?limit=abc` → `Too small: expected number to be >=1`)

> ข้อมูลนี้ถูก worker บันทึกอัตโนมัติทุก 60 วินาที (เฉพาะรถที่ status เป็น `active` และพิกัดไม่ใช่ 0,0) — ดู `REALTIME.md`

---

### 5.8 Assignment Driver (กะเวร) — `/assignment-driver`

> ⚠️ `data` ของ `GET /:id`, `GET /driver/:id`, `POST`, `PUT` เป็น **array** แม้เป็น single record — ต้องเอา `[0]`

#### `GET /assignment-driver` 🔒 admin, superadmin

ดูกะเวรทั้งหมด

```bash
curl -b cookies.txt http://localhost:3000/assignment-driver
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "e0000000-0000-4000-8000-000000000001",
      "carId": "c0000000-0000-4000-8000-000000000001",
      "driverId": "33333333-3333-4333-8333-333333333333",
      "startTime": "2025-01-17T00:00:00.000Z",
      "endTime": "2025-01-17T09:00:00.000Z",
      "createdAt": "2025-01-16T04:00:00.000Z",
      "updatedBy": "22222222-2222-4222-8222-222222222222",
      "updatedAt": "2025-01-16T04:00:00.000Z"
    }
  ]
}
```

---

#### `GET /assignment-driver/:id` 🔒 admin, superadmin, driver

ดูกะเวรตาม id

**Path** — `id` (uuid)

```bash
curl -b cookies.txt \
  http://localhost:3000/assignment-driver/e0000000-0000-4000-8000-000000000001
```

**Response `200`** — ⚠️ `data` เป็น **array**

```json
{
  "success": true,
  "data": [
    {
      "id": "e0000000-0000-4000-8000-000000000001",
      "carId": "c0000000-0000-4000-8000-000000000001",
      "driverId": "33333333-3333-4333-8333-333333333333",
      "startTime": "2025-01-17T00:00:00.000Z",
      "endTime": "2025-01-17T09:00:00.000Z",
      "createdAt": "2025-01-16T04:00:00.000Z",
      "updatedBy": "22222222-2222-4222-8222-222222222222",
      "updatedAt": "2025-01-16T04:00:00.000Z"
    }
  ]
}
```

---

#### `GET /assignment-driver/driver/:id` 🔒 admin, superadmin, driver

ดูกะเวรทั้งหมดของ driver คนนั้น

**Path** — `id` = **driverId** (uuid) ไม่ใช่ shiftId

```bash
curl -b cookies.txt \
  http://localhost:3000/assignment-driver/driver/33333333-3333-4333-8333-333333333333
```

**Response `200`** — array

---

#### `POST /assignment-driver` 🔒 admin, superadmin

สร้างกะเวร

**Request**

| Field       | Type            | Required | หมายเหตุ                                                       |
| ----------- | --------------- | :------: | -------------------------------------------------------------- |
| `carId`     | uuid            |    ✅    |                                                                |
| `driverId`  | uuid            |    ✅    | id ของ user ที่มี role `driver`                                |
| `startTime` | ISO 8601 string |    ✅    | เช่น `"2025-01-17T08:00:00+07:00"`                             |
| `endTime`   | ISO 8601 string |    ✅    | เช่น `"2025-01-17T17:00:00+07:00"`                             |
| `updatedBy` | uuid            |          | ⚠️ **ระบบเติมให้จาก session อัตโนมัติ** ค่าที่ส่งมาถูก discard |
| `id`        | uuid            |          | ถ้าไม่ส่งระบบ generate                                         |

```bash
curl -X POST -b cookies.txt http://localhost:3000/assignment-driver \
  -H 'Content-Type: application/json' \
  -d '{
    "carId": "c0000000-0000-4000-8000-000000000001",
    "driverId": "33333333-3333-4333-8333-333333333333",
    "startTime": "2025-01-17T08:00:00+07:00",
    "endTime": "2025-01-17T17:00:00+07:00"
  }'
```

**Response `200`** — ⚠️ **ไม่ใช่ 201** และ `data` เป็น array

**Errors** — `403` `ไม่มีสิทธิเข้าถึง` · `400` Zod error

---

#### `PUT /assignment-driver/:id` 🔒 admin, superadmin

แก้ไขกะเวร — เป็น **PUT** ไม่ใช่ PATCH (มีแค่ endpoint เดียวในระบบที่ใช้ PUT)

**Path** — `id` (uuid)

**Request** — schema เป็น partial (ทุก field optional) **แต่จริง ๆ `startTime` และ `endTime` บังคับต้องส่ง** เพราะ controller เขียนทับด้วย `new Date(req.body.x)` เสมอ ส่งไม่ครบจะได้ `Invalid Date` → 400

```bash
curl -X PUT -b cookies.txt \
  http://localhost:3000/assignment-driver/e0000000-0000-4000-8000-000000000001 \
  -H 'Content-Type: application/json' \
  -d '{
    "startTime": "2025-01-17T09:00:00+07:00",
    "endTime": "2025-01-17T18:00:00+07:00"
  }'
```

**Response `200`** — `data` เป็น array

> ⚠️ ถ้า `id` ไม่มีจริง → `data` เป็น **array ว่าง** `[]` ไม่ใช่ 404

---

#### `DELETE /assignment-driver/:id` 🔒 admin, superadmin

ลบกะเวร (**ลบจริง**)

```bash
curl -X DELETE -b cookies.txt \
  http://localhost:3000/assignment-driver/e0000000-0000-4000-8000-000000000001
```

**Response `200`** — ⚠️ **มีแค่ `success` ไม่มี `message` ไม่มี `data`** — เป็น endpoint เดียวในระบบที่เป็นแบบนี้

```json
{ "success": true }
```

---

### 5.9 Driving Logs — `/driving-logs`

#### `POST /driving-logs/start` 🔒 driver

คนขับกดเริ่มงาน

**Request**

| Field     | Type | Required | หมายเหตุ                                   |
| --------- | ---- | :------: | ------------------------------------------ |
| `shiftId` | uuid |    ✅    | ต้องเป็น shift ที่ assign ให้ driver คนนี้ |

```bash
curl -X POST -b cookies.txt http://localhost:3000/driving-logs/start \
  -H 'Content-Type: application/json' \
  -d '{ "shiftId": "e0000000-0000-4000-8000-000000000001" }'
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "f0000000-0000-4000-8000-000000000001",
    "shiftId": "e0000000-0000-4000-8000-000000000001",
    "startedAt": "2025-01-17T01:00:00.000Z",
    "endedAt": null,
    "status": "active",
    "createdAt": "2025-01-17T01:00:00.000Z"
  }
}
```

> `endedAt: null` = ยังขับอยู่ · `status: "active"` = กำลังขับ

**สิ่งที่เกิดขึ้นเบื้องหลัง**

- เขียน Redis `driver:state:{driverId}` = `{ status, carId, logId, alertSentAt: null }`
- เขียน Redis `car:activeDriver:{carId}` = driverId
- ตั้งแต่นี้ ถ้ารถวิ่งแล้วไม่มี alert → ระบบจะไม่ส่ง alert มาอีก

**Errors**

| Code     | message                                            |
| -------- | -------------------------------------------------- |
| `403`    | `เฉพาะคนขับเท่านั้นที่สามารถเริ่มงานได้`           |
| `400`    | `shiftId ต้องเป็น UUID`                            |
| `500` ⚠️ | `ไม่พบ shift หรือคุณไม่มีสิทธิ์เริ่มงาน shift นี้` |
| `500` ⚠️ | `มี log ที่กำลังทำอยู่ กรุณาจบก่อนเริ่มงานใหม่`    |

---

#### `POST /driving-logs/end` 🔒 driver

คนขับกดหยุดงาน

**Request**

| Field   | Type | Required | หมายเหตุ                              |
| ------- | ---- | :------: | ------------------------------------- |
| `logId` | uuid |    ✅    | ต้องเป็น log ของตัวเองที่ยัง `active` |

```bash
curl -X POST -b cookies.txt http://localhost:3000/driving-logs/end \
  -H 'Content-Type: application/json' \
  -d '{ "logId": "f0000000-0000-4000-8000-000000000001" }'
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "f0000000-0000-4000-8000-000000000001",
    "shiftId": "e0000000-0000-4000-8000-000000000001",
    "startedAt": "2025-01-17T01:00:00.000Z",
    "endedAt": "2025-01-17T08:30:00.000Z",
    "status": "ended",
    "createdAt": "2025-01-17T01:00:00.000Z"
  }
}
```

**Errors**

| Code     | message                                                  |
| -------- | -------------------------------------------------------- |
| `403`    | `เฉพาะคนขับเท่านั้นที่สามารถหยุดงานได้`                  |
| `400`    | `logId ต้องเป็น UUID`                                    |
| `500` ⚠️ | `ไม่พบ log ที่กำลัง active หรือคุณไม่มีสิทธิ์หยุดงานนี้` |

---

#### `GET /driving-logs/current` 🔒 driver

ดูงานที่กำลังทำอยู่

```bash
curl -b cookies.txt http://localhost:3000/driving-logs/current
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "f0000000-0000-4000-8000-000000000001",
    "shiftId": "e0000000-0000-4000-8000-000000000001",
    "startedAt": "2025-01-17T01:00:00.000Z",
    "endedAt": null,
    "status": "active",
    "createdAt": "2025-01-17T01:00:00.000Z"
  }
}
```

**ถ้ายังไม่เคยขับ:** `data` เป็น `null`

```json
{ "success": true, "data": null }
```

**Errors** — `403` `เฉพาะคนขับเท่านั้นที่สามารถดูงานที่กำลังทำอยู่ได้`

---

#### `GET /driving-logs/my` 🔒 driver, admin, superadmin

ประวัติการขับของตัวเอง — เรียงตามเวลาเริ่ม

```bash
curl -b cookies.txt http://localhost:3000/driving-logs/my
```

**Response `200`** — ⚠️ แต่ละ element เป็น **object ห่อ `log`**

```json
{
  "success": true,
  "data": [
    {
      "log": {
        "id": "f0000000-0000-4000-8000-000000000001",
        "shiftId": "e0000000-0000-4000-8000-000000000001",
        "startedAt": "2025-01-17T01:00:00.000Z",
        "endedAt": "2025-01-17T08:30:00.000Z",
        "status": "ended",
        "createdAt": "2025-01-17T01:00:00.000Z"
      },
      "carId": "c0000000-0000-4000-8000-000000000001",
      "shiftStartTime": "2025-01-17T01:00:00.000Z",
      "shiftEndTime": "2025-01-17T09:00:00.000Z"
    }
  ]
}
```

**Errors** — `403` `ไม่มีสิทธิ์เข้าถึง`

---

#### `GET /driving-logs` 🔒 admin, superadmin

ประวัติการขับทั้งหมด

```bash
curl -b cookies.txt http://localhost:3000/driving-logs
```

**Response `200`** — ต่างจาก `/my` ตรงที่มี `driverId` แทน `shiftStartTime`/`shiftEndTime`

```json
{
  "success": true,
  "data": [
    {
      "log": {
        "id": "f0000000-0000-4000-8000-000000000001",
        "shiftId": "e0000000-0000-4000-8000-000000000001",
        "startedAt": "2025-01-17T01:00:00.000Z",
        "endedAt": "2025-01-17T08:30:00.000Z",
        "status": "ended",
        "createdAt": "2025-01-17T01:00:00.000Z"
      },
      "driverId": "33333333-3333-4333-8333-333333333333",
      "carId": "c0000000-0000-4000-8000-000000000001"
    }
  ]
}
```

**Errors** — `403` `ไม่มีสิทธิ์เข้าถึง`

---

## 6. Data Models

### `users`

```json
{
  "id": "uuid",
  "email": "string",
  "hashPassword": "string",
  "role": "superadmin | admin | user | driver",
  "firstName": "string | null",
  "lastName": "string | null",
  "profileImageUrl": "string | null",
  "phoneNumber": "string | null",
  "createdAt": "ISO8601",
  "deletedAt": "ISO8601 | null"
}
```

### `admin_invites`

```json
{
  "email": "string",
  "addedBy": "uuid",
  "status": "pending | accepted",
  "createdAt": "ISO8601",
  "role": "superadmin | admin | driver"
}
```

### `routes`

```json
{
  "id": "uuid",
  "createdAt": "ISO8601",
  "name": "string",
  "updatedBy": "uuid | null",
  "updatedAt": "ISO8601",
  "deletedAt": "ISO8601 | null"
}
```

### `route_points`

```json
{
  "id": "uuid",
  "routeId": "uuid",
  "sequence": 10000,
  "lat": 18.7883,
  "lng": 98.9853,
  "name": "string | null",
  "timeToNextSecs": 300
}
```

### `cars`

```json
{
  "id": "uuid",
  "createdAt": "ISO8601",
  "routeId": "uuid | null",
  "updatedBy": "uuid | null",
  "updatedAt": "ISO8601",
  "carMqttUsername": "car_a1b2c3d4e5f6",
  "carNumber": "กรุงเทพ-001",
  "status": "active | inactive",
  "deletedAt": "ISO8601 | null"
}
```

> `encryptedMqttPassword` **ไม่เคย** ถูกส่งกลับใน response ใดเลย — ถ้าเห็น แปลว่าโค้ดผิด

### `car_history_log`

```json
{
  "id": "uuid",
  "createdAt": "ISO8601",
  "carId": "uuid",
  "lat": 18.7883,
  "lng": 98.9853
}
```

### `car_driver_shifts`

```json
{
  "id": "uuid",
  "carId": "uuid",
  "driverId": "uuid",
  "startTime": "ISO8601",
  "endTime": "ISO8601",
  "createdAt": "ISO8601",
  "updatedBy": "uuid",
  "updatedAt": "ISO8601"
}
```

### `driving_logs`

```json
{
  "id": "uuid",
  "shiftId": "uuid",
  "startedAt": "ISO8601",
  "endedAt": "ISO8601 | null",
  "status": "active | ended",
  "createdAt": "ISO8601"
}
```

### Live position (ไม่มีใน DB — มาจาก Redis)

```json
{
  "type": "location",
  "carId": "uuid",
  "lat": 18.7883,
  "lng": 98.9853,
  "status": "active | inactive",
  "createdAt": "ISO8601"
}
```

---

---

## 8. สิ่งที่ทำให้เข้าใจผิด

### วันที่ส่งไม่ได้

`POST /routes`, `PATCH /routes/:id`, `POST /route-points`, `PATCH /route-points/:id` ใช้ zod schema ที่แปลง timestamp เป็น `z.date()` **โดยไม่ coerce**

→ ส่ง `"createdAt": "2025-01-15T03:00:00Z"` (string) จะได้:

```json
{
  "success": false,
  "message": "Invalid input: expected date, received string"
}
```

→ **แก้โดยไม่ต้องส่ง field วันที่เลย** ปล่อยให้ระบบเติมเอง (ส่งได้เฉพาะ `PATCH /route-points/:id` เพราะใช้ `doublePrecision`/`integer` ไม่ใช่ timestamp)
