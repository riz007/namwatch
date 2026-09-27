/**
 * Database schema..
 *
 * Two documented additions to the spec, agreed before implementation:
 *
 * 1. `provenance` — SPEC distinguishes "official" from "crowd" data,
 * but Traffy Fondue is neither: it is citizen-reported through the official BMA
 * queue. Collapsing it into either category would mislabel it, so provenance is
 * a three-valued column and the UI renders a distinct marker per value.
 *
 * 2. `external_reports` — Traffy items are point events with a workflow state. They
 * are not sensor readings (no `stations`/`station_readings` fit) and not ours
 * (no device hash, no votes, no expiry), so they get their own table.
 *
 * Indexes and the PostGIS extension are added in the generated migration.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { geographyPoint, geometryMultiPolygon } from "./types.ts";

// Re-exported so existing imports from the schema keep working; the values
// themselves live in config so client code can use them without the driver.
export {
  PROVENANCE,
  READING_STATUSES,
  REPORT_KINDS,
  REPORT_STATUSES,
  STATION_KINDS,
  VOTE_KINDS,
} from "@/config/reports.ts";
export type { Provenance } from "@/config/reports.ts";

// ---------------------------------------------------------------------------

export const regions = pgTable(
  "regions",
  {
    id: text("id").primaryKey(),
    level: text("level").notNull(),
    parentId: text("parent_id"),
    nameTh: text("name_th").notNull(),
    nameEn: text("name_en").notNull(),
    slug: text("slug").notNull().unique(),
    geom: geometryMultiPolygon("geom"),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [
    check(
      "regions_level_check",
      sql`${t.level} in ('province','district','subdistrict')`,
    ),
    index("regions_parent_idx").on(t.parentId),
  ],
);

export const stations = pgTable(
  "stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    kind: text("kind").notNull(),
    nameTh: text("name_th"),
    nameEn: text("name_en"),
    geom: geographyPoint("geom").notNull(),
    regionId: text("region_id").references(() => regions.id),
    /** Metres MSL. Documented per source in the source documentation. */
    bankLevelM: numeric("bank_level_m"),
    groundLevelM: numeric("ground_level_m"),
    meta: jsonb("meta").notNull().default({}),
  },
  (t) => [
    unique("stations_source_external_id_key").on(t.source, t.externalId),
    check(
      "stations_kind_check",
      sql`${t.kind} in ('canal_level','river_level','road_flood','rain')`,
    ),
    index("stations_region_idx").on(t.regionId),
  ],
);

export const stationReadings = pgTable(
  "station_readings",
  {
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    /**
     * Unit depends on the station kind and is normalised in the adapter
     *: water level in metres MSL, road flood in cm, rain in mm.
     */
    value: numeric("value").notNull(),
    status: text("status"),
  },
  (t) => [
    primaryKey({ columns: [t.stationId, t.observedAt] }),
    check(
      "station_readings_status_check",
      sql`${t.status} is null or ${t.status} in ('normal','watch','warning','critical','unknown')`,
    ),
    index("station_readings_observed_idx").on(t.observedAt),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    kind: text("kind").notNull(),
    depthBand: smallint("depth_band").notNull(),
    passableBy: text("passable_by").array(),
    note: text("note"),
    locale: text("locale").notNull(),
    /**
     * / the exact point never leaves the server. Public
     * responses use geom_public, which is H3-r9-snapped for `home` and `help`.
     */
    geomExact: geographyPoint("geom_exact").notNull(),
    geomPublic: geographyPoint("geom_public").notNull(),
    h3R9: text("h3_r9").notNull(),
    regionId: text("region_id").references(() => regions.id),
    photoKey: text("photo_key"),
    /**
     * sha256(deviceId + SERVER_SALT). Never the raw id.
     *
     * Nullable because it is cleared on the seventh day, which is what the
     * privacy notice promises. It is only needed to rate-limit the minutes
     * around a submission; keeping it for the life of the row served nothing.
     */
    deviceHash: text("device_hash"),
    ipHash: text("ip_hash"),
    stillCount: integer("still_count").notNull().default(0),
    recededCount: integer("receded_count").notNull().default(0),
    flagCount: integer("flag_count").notNull().default(0),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check(
      "reports_kind_check",
      sql`${t.kind} in ('road','home','canal','help')`,
    ),
    check("reports_depth_band_check", sql`${t.depthBand} between 0 and 5`),
    check("reports_note_length_check", sql`char_length(${t.note}) <= 280`),
    check("reports_locale_check", sql`${t.locale} in ('th','en')`),
    check(
      "reports_status_check",
      sql`${t.status} in ('active','hidden','removed','expired')`,
    ),
    index("reports_status_expires_idx").on(t.status, t.expiresAt),
    index("reports_h3_idx").on(t.h3R9),
    index("reports_region_idx").on(t.regionId),
    index("reports_created_idx").on(t.createdAt),
  ],
);

export const reportVotes = pgTable(
  "report_votes",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    vote: text("vote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.reportId, t.deviceHash, t.vote] }),
    check(
      "report_votes_vote_check",
      sql`${t.vote} in ('still','receded','flag')`,
    ),
  ],
);

/**
 * Third-party reports (currently Traffy Fondue). See the header note.
 * These are read-only mirrors of an upstream queue: we never mutate their state.
 */
export const externalReports = pgTable(
  "external_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    provenance: text("provenance").notNull(),
    kind: text("kind").notNull(),
    geom: geographyPoint("geom").notNull(),
    regionId: text("region_id").references(() => regions.id),
    /** Upstream workflow state, kept verbatim so we never misreport it. */
    state: text("state"),
    description: text("description"),
    url: text("url"),
    photoUrl: text("photo_url"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    meta: jsonb("meta").notNull().default({}),
  },
  (t) => [
    unique("external_reports_source_external_id_key").on(
      t.source,
      t.externalId,
    ),
    check(
      "external_reports_provenance_check",
      sql`${t.provenance} in ('official_sensor','official_channel','crowd')`,
    ),
    index("external_reports_observed_idx").on(t.observedAt),
    index("external_reports_region_idx").on(t.regionId),
  ],
);

export const sourceHealth = pgTable("source_health", {
  source: text("source").primaryKey(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const moderationLog = pgTable("moderation_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reportId: uuid("report_id"),
  action: text("action").notNull(),
  actor: text("actor"),
  reason: text("reason"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
