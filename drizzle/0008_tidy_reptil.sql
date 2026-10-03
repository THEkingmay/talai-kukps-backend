ALTER TABLE "notifications" DROP CONSTRAINT "notifications_car_id_cars_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_driver_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "notifications_created_at_idx";--> statement-breakpoint
DROP INDEX "notifications_car_id_idx";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "car_id";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "driver_id";