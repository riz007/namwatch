/**
 * Report vocabulary, shared by the database schema, the API and the UI.
 *
 * These live outside `lib/db` on purpose: the report form is a client component
 * and must not import the schema module, which would pull the database driver
 * into the browser bundle.
 */
export const REPORT_KINDS = ['road', 'home', 'canal', 'help'] as const;
export const REPORT_STATUSES = ['active', 'hidden', 'removed', 'expired'] as const;
export const STATION_KINDS = ['canal_level', 'river_level', 'road_flood', 'rain'] as const;
export const READING_STATUSES = ['normal', 'watch', 'warning', 'critical', 'unknown'] as const;
export const VOTE_KINDS = ['still', 'receded', 'flag'] as const;
export const PROVENANCE = ['official_sensor', 'official_channel', 'crowd'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReadingStatus = (typeof READING_STATUSES)[number];
export type VoteKind = (typeof VOTE_KINDS)[number];
export type Provenance = (typeof PROVENANCE)[number];
