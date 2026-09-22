# API Documentation (talai-kukps-backend)

เอกสารนี้รวบรวม API Endpoints ทั้งหมดที่มีการประกาศใช้งานใน `src/app.ts` และ `src/routes/index.ts` รวมถึงรายละเอียด Request Body สำหรับ Method

---

## 1. Auth (`/auth`)

จัดการเกี่ยวกับการเข้าสู่ระบบและการสมัครสมาชิก (อ้างอิงจาก `src/modules/auth/auth.route.ts`)

### `POST /auth/login`

- **Description:** เข้าสู่ระบบ
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "your_password"
  }
  ```

### `POST /auth/register`

- **Description:** สมัครสมาชิกใหม่
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "your_password"
  }
  ```

### `POST /auth/request-reset-password`

- **Description:** ร้องขอการรีเซ็ตรหัสผ่าน (ส่งอีเมล)
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

### `POST /auth/reset-password`

- **Description:** ตั้งรหัสผ่านใหม่ด้วย Token
- **Request Body:**
  ```json
  {
    "token": "reset_token_from_email",
    "password": "new_password"
  }
  ```

### `GET /auth/logout`

- **Description:** ออกจากระบบ (ล้าง Session)
- **Middleware:** `sessionMiddleware`

### `GET /auth/login-with-session`

- **Description:** ดึงข้อมูล user ปัจจุบันจาก Session
- **Middleware:** `sessionMiddleware`

---

## 2. Users (`/users`)

จัดการข้อมูลผู้ใช้งานในระบบ (อ้างอิงจาก `src/modules/users/users.route.ts`)
_ทุกเส้นทางในหมวดนี้ ต้องผ่าน `sessionMiddleware`_

### `GET /users/`

- **Description:** ดึงข้อมูลผู้ใช้งานทั้งหมด

### `GET /users/me`

- **Description:** ดึงข้อมูลของตัวเอง

### `DELETE /users/:id`

- **Description:** ลบผู้ใช้งาน (Soft delete)
- **Path Parameter:** `id` (UUID ของผู้ใช้)

### `PATCH /users/restore/:id`

- **Description:** กู้คืนผู้ใช้งานที่ถูกลบไปแล้ว
- **Path Parameter:** `id` (UUID ของผู้ใช้)

---

## 3. Cars (`/cars`)

จัดการข้อมูลรถ (อ้างอิงจาก `src/modules/cars/cars.route.ts`)

### `GET /cars/`

- **Description:** ดึงข้อมูลรถทั้งหมด
- **Middleware:** `mobileTokenMiddleware`

### `GET /cars/live-positions`

- **Description:** ดึงข้อมูลตำแหน่งรถแบบ Real-time
- **Middleware:** `mobileTokenMiddleware`

### `GET /cars/:id`

- **Description:** ดึงข้อมูลรถตาม ID
- **Middleware:** `mobileTokenMiddleware`
- **Path Parameter:** `id` (UUID)

### `POST /cars/`

- **Description:** เพิ่มรถคันใหม่
- **Middleware:** `sessionMiddleware`
- **Request Body:**
  ```json
  {
    "routeId": "uuid-of-route",
    "carNumber": "สาย 1"
  }
  ```

### `PATCH /cars/:id`

- **Description:** แก้ไขข้อมูลรถ
- **Middleware:** `sessionMiddleware`
- **Path Parameter:** `id` (UUID)
- **Request Body:**
  ```json
  {
    "id": "uuid-of-car",
    "routeId": "uuid-of-route",
    "carNumber": "สาย 1",
    "status": "active" // หรือ "inactive"
  }
  ```

### `DELETE /cars/:id`

- **Description:** ลบรถ (Soft Delete)
- **Middleware:** `sessionMiddleware`

### `PATCH /cars/restore/:id`

- **Description:** กู้คืนข้อมูลรถที่ถูกลบ
- **Middleware:** `sessionMiddleware`

### `GET /cars/mqtt-credentials/:id`

- **Description:** ดึงข้อมูล MQTT Credentials ของรถแต่ละคัน (สำหรับให้รถใช้เชื่อมต่อ MQTT)
- **Middleware:** `sessionMiddleware`

### `POST /cars/mqtt-credentials/:id/reset`

- **Description:** รีเซ็ต/สร้างรหัสผ่าน MQTT ใหม่สำหรับรถ
- **Middleware:** `sessionMiddleware`

---

## 4. Routes (`/routes`)

จัดการเส้นทางเดินรถ (อ้างอิงจาก `src/modules/routes/routes.route.ts`)

### `GET /routes/`

- **Description:** ดึงข้อมูลเส้นทางทั้งหมด
- **Middleware:** `mobileTokenMiddleware`

### `GET /routes/:id`

- **Description:** ดึงข้อมูลเส้นทางตาม ID
- **Middleware:** `mobileTokenMiddleware`

### `POST /routes/`

- **Description:** สร้างเส้นทางใหม่
- **Middleware:** `sessionMiddleware`
- **Request Body:**
  ```json
  {
    "name": "ชื่อเส้นทาง (เช่น สาย 1 วนซ้าย)"
  }
  ```

### `PATCH /routes/:id`

- **Description:** แก้ไขชื่อเส้นทาง
- **Middleware:** `sessionMiddleware`
- **Path Parameter:** `id` (UUID)
- **Request Body:**
  ```json
  {
    "name": "ชื่อเส้นทางที่แก้ไขแล้ว"
  }
  ```

### `DELETE /routes/:id`

- **Description:** ลบเส้นทาง (Soft Delete)
- **Middleware:** `sessionMiddleware`

### `PATCH /routes/restore/:id`

- **Description:** กู้คืนเส้นทางที่ถูกลบ
- **Middleware:** `sessionMiddleware`

---

## 5. Route Points (`/route-points`)

จุดจอดหรือพิกัดของเส้นทาง (อ้างอิงจาก `src/modules/route-points/route-points.route.ts`)

### `GET /route-points/by-route/:routeId`

- **Description:** ดึงพิกัดทั้งหมดในเส้นทาง (เรียงตาม sequence)
- **Middleware:** `mobileTokenMiddleware`
- **Path Parameter:** `routeId` (UUID)

### `POST /route-points/`

- **Description:** เพิ่มจุดพิกัดลงในเส้นทาง (รองรับทั้งแบบ Object เดี่ยว หรือ Array)
- **Middleware:** `sessionMiddleware`
- **Request Body (Array):**
  ```json
  [
    {
      "routeId": "uuid-of-route",
      "sequence": 10000,
      "lat": 13.736717,
      "lng": 100.523186,
      "name": "ป้ายหน้ามอ",
      "timeToNextSecs": 120
    }
  ]
  ```

### `PATCH /route-points/:id`

- **Description:** อัปเดตข้อมูลของจุดพิกัด
- **Middleware:** `sessionMiddleware`
- **Path Parameter:** `id` (UUID)
- **Request Body:** _(สามารถส่งเฉพาะฟิลด์ที่ต้องการแก้ได้)_
  ```json
  {
    "sequence": 15000,
    "lat": 13.736717,
    "lng": 100.523186,
    "name": "ป้ายหน้ามอแก้ไข",
    "timeToNextSecs": 150
  }
  ```

### `DELETE /route-points/:id`

- **Description:** ลบจุดพิกัดนั้นออก (Hard Delete)
- **Middleware:** `sessionMiddleware`

---

## 6. Admin Invites (`/admin-invites`)

ระบบเชิญแอดมินหรือคนขับ (อ้างอิงจาก `src/modules/admin-invites/admin-invites.route.ts`)
_ทุกเส้นทางในหมวดนี้ ต้องผ่าน `sessionMiddleware`_

### `GET /admin-invites/`

- **Description:** ดูรายชื่อคำเชิญทั้งหมด

### `POST /admin-invites/`

- **Description:** สร้างคำเชิญให้เข้าร่วมระบบ
- **Request Body:**
  ```json
  {
    "email": "new.admin@example.com",
    "role": "admin" // หรือ "driver"
  }
  ```

### `DELETE /admin-invites/:email`

- **Description:** ยกเลิกคำเชิญ
- **Path Parameter:** `email` (อีเมลที่ส่งคำเชิญไป)

---

## 7. Car History Logs (`/car-history-logs`)

ประวัติการเดินทางของรถ (อ้างอิงจาก `src/modules/car-history-logs/car-history-logs.route.ts`)
_ทุกเส้นทางในหมวดนี้ ต้องผ่าน `sessionMiddleware`_

### `GET /car-history-logs/by-car/:carId`

- **Description:** ดูประวัติการเดินทางของรถคันที่เลือก
- **Path Parameter:** `carId` (UUID)
- **Query Parameter (Optional):** `?limit=100` (จำนวนที่ต้องการดึง)

---

## 8. Development Only Endpoints (ใน `src/app.ts`)

_(เปิดให้ใช้งานเฉพาะตอน `NODE_ENV === "development"`)_

### `GET /see-redis`

- **Description:** ดูข้อมูลทั้งหมดที่ค้างอยู่ใน Redis

### `GET /clear-redis`

- **Description:** เคลียร์ข้อมูลทั้งหมดใน Redis
