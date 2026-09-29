CREATE TABLE "dams" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"lon" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"max_storage_mcm" numeric,
	"storage_mcm" numeric,
	"storage_pct" numeric,
	"inflow_mcm" numeric,
	"released_mcm" numeric,
	"spilled_mcm" numeric,
	"observed_on" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station_readings" ADD COLUMN "discharge_m3s" numeric;--> statement-breakpoint
CREATE INDEX "dams_source_idx" ON "dams" USING btree ("source");--> statement-breakpoint
-- Deny-all RLS, matching every other table (AGENTS.md rule 28). The app
-- connects as the owner and is unaffected; a leaked public key reads nothing.
ALTER TABLE "dams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.dams FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.dams FROM authenticated;
  END IF;
END $$;
