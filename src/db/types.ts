import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import {
  userRoleEnum,
  inviteStatusEnum,
  carStatusEnum,
  users,
  adminInvites,
  routes,
  routePoints,
  cars,
  carHistoryLog,
  carDriverShifts,
  drivingLogs,
  drivingStatusEnum,
  notifications,
  notificationAlertTypeEnum,
} from "./schema.ts";

export const userRoleSchema = createSelectSchema(userRoleEnum);
export type UserRole = z.infer<typeof userRoleSchema>;

export const inviteStatusSchema = createSelectSchema(inviteStatusEnum);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const carStatusSchema = createSelectSchema(carStatusEnum);
export type CarStatus = z.infer<typeof carStatusSchema>;

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

export const selectUserSchema = createSelectSchema(users);
export const dbInsertUserSchema = createInsertSchema(users);
export const insertUserSchema = dbInsertUserSchema
  .omit({ hashPassword: true })
  .extend({
    password: z.string().min(8, "Password ต้องมีอย่างน้อย 8 ตัวอักษร"),
  });
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;

export const selectAdminInviteSchema = createSelectSchema(adminInvites);
export const insertAdminInviteSchema = createInsertSchema(adminInvites, {
  email: (schema) => schema.email(),
});

export type AdminInvite = z.infer<typeof selectAdminInviteSchema>;
export type NewAdminInvite = z.infer<typeof insertAdminInviteSchema>;

export const selectRouteSchema = createSelectSchema(routes);
export const insertRouteSchema = createInsertSchema(routes);

export type Route = z.infer<typeof selectRouteSchema>;
export type NewRoute = z.infer<typeof insertRouteSchema>;
export const selectRoutePointSchema = createSelectSchema(routePoints, {
  lat: latSchema,
  lng: lngSchema,
});
export const insertRoutePointSchema = createInsertSchema(routePoints, {
  lat: latSchema,
  lng: lngSchema,
  timeToNextSecs: (schema) => schema.nonnegative().optional(),
});

export type RoutePoint = z.infer<typeof selectRoutePointSchema>;
export type NewRoutePoint = z.infer<typeof insertRoutePointSchema>;

export const selectCarSchema = createSelectSchema(cars);
export const dbInsertCarSchema = createInsertSchema(cars);
export const insertCarSchema = dbInsertCarSchema.extend({
  carMqttUsername: z.string().optional(),
  encryptedMqttPassword: z.string().optional(),
});

export type Car = z.infer<typeof selectCarSchema>;
export type NewCar = z.infer<typeof insertCarSchema>;
export type ResponseCarData = {
  id: string;
  createdAt: Date;
  deletedAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date;
  routeId: string | null;
  carNumber: string;
  status: "active" | "inactive";
  driverData?: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    email: string | null;
  } | null;
};

export const selectCarHistoryLogSchema = createSelectSchema(carHistoryLog, {
  lat: latSchema,
  lng: lngSchema,
});
export const insertCarHistoryLogSchema = createInsertSchema(carHistoryLog, {
  lat: latSchema,
  lng: lngSchema,
});

export type CarHistoryLog = z.infer<typeof selectCarHistoryLogSchema>;
export type NewCarHistoryLog = z.infer<typeof insertCarHistoryLogSchema>;

export const selectCarDriverShiftSchema = createSelectSchema(carDriverShifts);
export type CarDriverShift = z.infer<typeof selectCarDriverShiftSchema>;
export type NewCarDriverShift = z.infer<typeof insertCarDriverShiftSchema>;
export const insertCarDriverShiftSchema = createInsertSchema(carDriverShifts);
export const updateCarDriverShiftSchema = createUpdateSchema(carDriverShifts);
export type UpdatedCarDriverShift = z.infer<typeof updateCarDriverShiftSchema>;

export const drivingStatusSchema = createSelectSchema(drivingStatusEnum);
export type DrivingStatus = z.infer<typeof drivingStatusSchema>;

export const selectDrivingLogSchema = createSelectSchema(drivingLogs);
export const insertDrivingLogSchema = createInsertSchema(drivingLogs);
export const updateDrivingLogSchema = createUpdateSchema(drivingLogs);

export type DrivingLog = z.infer<typeof selectDrivingLogSchema>;
export type NewDrivingLog = z.infer<typeof insertDrivingLogSchema>;
export type UpdatedDrivingLog = z.infer<typeof updateDrivingLogSchema>;

export const notificationAlertTypeSchema = createSelectSchema(
  notificationAlertTypeEnum,
);
export type NotificationAlertType = z.infer<typeof notificationAlertTypeSchema>;

export const selectNotificationSchema = createSelectSchema(notifications);
export const insertNotificationSchema = createInsertSchema(notifications);

export type Notification = z.infer<typeof selectNotificationSchema>;
export type NewNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationPayloadType_driver_not_confirmed = {
  carId: string;
  timestamp: string;
};
