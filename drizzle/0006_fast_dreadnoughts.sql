CREATE TYPE "public"."driving_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "driving_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "driving_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driving_logs" ADD CONSTRAINT "driving_logs_shift_id_car_driver_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."car_driver_shifts"("id") ON DELETE cascade ON UPDATE no action;