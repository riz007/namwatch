CREATE TABLE "external_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"provenance" text NOT NULL,
	"kind" text NOT NULL,
	"geom" geography(Point,4326) NOT NULL,
	"region_id" text,
	"state" text,
	"description" text,
	"url" text,
	"photo_url" text,
	"observed_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "external_reports_source_external_id_key" UNIQUE("source","external_id"),
	CONSTRAINT "external_reports_provenance_check" CHECK ("external_reports"."provenance" in ('official_sensor','official_channel','crowd'))
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"report_id" uuid,
	"action" text NOT NULL,
	"actor" text,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" text PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"parent_id" text,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326),
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "regions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "regions_level_check" CHECK ("regions"."level" in ('province','district','subdistrict'))
);
--> statement-breakpoint
CREATE TABLE "report_votes" (
	"report_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"vote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_votes_report_id_device_hash_vote_pk" PRIMARY KEY("report_id","device_hash","vote"),
	CONSTRAINT "report_votes_vote_check" CHECK ("report_votes"."vote" in ('still','receded','flag'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"depth_band" smallint NOT NULL,
	"passable_by" text[],
	"note" text,
	"locale" text NOT NULL,
	"geom_exact" geography(Point,4326) NOT NULL,
	"geom_public" geography(Point,4326) NOT NULL,
	"h3_r9" text NOT NULL,
	"region_id" text,
	"photo_key" text,
	"device_hash" text NOT NULL,
	"ip_hash" text,
	"still_count" integer DEFAULT 0 NOT NULL,
	"receded_count" integer DEFAULT 0 NOT NULL,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reports_kind_check" CHECK ("reports"."kind" in ('road','home','canal','help')),
	CONSTRAINT "reports_depth_band_check" CHECK ("reports"."depth_band" between 0 and 5),
	CONSTRAINT "reports_note_length_check" CHECK (char_length("reports"."note") <= 280),
	CONSTRAINT "reports_locale_check" CHECK ("reports"."locale" in ('th','en')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('active','hidden','removed','expired'))
);
--> statement-breakpoint
CREATE TABLE "source_health" (
	"source" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_readings" (
	"station_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"value" numeric NOT NULL,
	"status" text,
	CONSTRAINT "station_readings_station_id_observed_at_pk" PRIMARY KEY("station_id","observed_at"),
	CONSTRAINT "station_readings_status_check" CHECK ("station_readings"."status" is null or "station_readings"."status" in ('normal','watch','warning','critical','unknown'))
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"kind" text NOT NULL,
	"name_th" text,
	"name_en" text,
	"geom" geography(Point,4326) NOT NULL,
	"region_id" text,
	"bank_level_m" numeric,
	"ground_level_m" numeric,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "stations_source_external_id_key" UNIQUE("source","external_id"),
	CONSTRAINT "stations_kind_check" CHECK ("stations"."kind" in ('canal_level','river_level','road_flood','rain'))
);
--> statement-breakpoint
ALTER TABLE "external_reports" ADD CONSTRAINT "external_reports_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_votes" ADD CONSTRAINT "report_votes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_readings" ADD CONSTRAINT "station_readings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_reports_observed_idx" ON "external_reports" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "external_reports_region_idx" ON "external_reports" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "regions_parent_idx" ON "regions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "reports_status_expires_idx" ON "reports" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "reports_h3_idx" ON "reports" USING btree ("h3_r9");--> statement-breakpoint
CREATE INDEX "reports_region_idx" ON "reports" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "reports_created_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "station_readings_observed_idx" ON "station_readings" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "stations_region_idx" ON "stations" USING btree ("region_id");