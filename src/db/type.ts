import { createInsertSchema, createSelectSchema } from "drizzle-zod";
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
export const insertUserSchema = createInsertSchema(users, {
    email: (schema) => schema.email(),
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
export const insertCarSchema = createInsertSchema(cars);

export type Car = z.infer<typeof selectCarSchema>;
export type NewCar = z.infer<typeof insertCarSchema>;

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
