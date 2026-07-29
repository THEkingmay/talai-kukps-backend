CREATE TYPE "car_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "invite_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "admin_invites" (
	"email" varchar PRIMARY KEY,
	"added_by" uuid NOT NULL,
	"invite_code" varchar NOT NULL,
	"status" "invite_status" DEFAULT 'pending'::"invite_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_history_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"car_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"route_id" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"car_mqtt_username" varchar NOT NULL UNIQUE,
	"encrypted_mqtt_password" text NOT NULL,
	"car_number" varchar NOT NULL UNIQUE,
	"status" "car_status" DEFAULT 'inactive'::"car_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"route_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"name" varchar,
	"time_to_next_secs" integer
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar NOT NULL UNIQUE,
	"hash_password" text NOT NULL,
	"role" "user_role" DEFAULT 'user'::"user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_added_by_users_id_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "car_history_log" ADD CONSTRAINT "car_history_log_car_id_cars_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_route_id_routes_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id");--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_route_id_routes_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");