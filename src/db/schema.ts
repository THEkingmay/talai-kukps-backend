import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { de } from "zod/v4/locales";

export const userRoleEnum = pgEnum("user_role", [
  "superadmin",
  "admin",
  "user",
  "driver",
]);
// export const userStatusEnum = pgEnum("user_status", [
//   "active",
//   "suspended",
//   "deleted",
// ]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  // "rejected",
]);

export const carStatusEnum = pgEnum("car_status", ["active", "inactive"]);

export const inviteRoleEnum = pgEnum("invite_role", ["admin", "driver"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email").notNull().unique(),
  hashPassword: text("hash_password").notNull(),
  // status: userStatusEnum("status").default("active").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const adminInvites = pgTable("admin_invites", {
  email: varchar("email").primaryKey(),
  addedBy: uuid("added_by")
    .notNull()
    .references(() => users.id),
  status: inviteStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  role: inviteRoleEnum("role").default("admin").notNull(),
});

export const routes = pgTable("routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  name: varchar("name").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const routePoints = pgTable("route_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  // ลบเส้นทาง จุดต้องหายไปด้วย (Cascade)
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  // ใช้ number สำหรับ (หน้า+หลัง)/2 ทำ range sequence ให้กว้างๆ ปัดเศษทิ้งเท่านั้น
  // A seq=10000
  // B seq=20000
  // แทรก C = 15000->(10000+20000)/2
  sequence: integer("sequence").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  name: varchar("name"),
  timeToNextSecs: integer("time_to_next_secs"),
});

export const cars = pgTable("cars", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  routeId: uuid("route_id").references(() => routes.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  carMqttUsername: varchar("car_mqtt_username").notNull().unique(),
  encryptedMqttPassword: text("encrypted_mqtt_password").notNull(),
  carNumber: varchar("car_number").notNull().unique(),
  status: carStatusEnum("status").default("inactive").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const carHistoryLog = pgTable("car_history_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  carId: uuid("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
});

export const carDriverShifts = pgTable("car_driver_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  carId: uuid("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  driverId: uuid("driver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
