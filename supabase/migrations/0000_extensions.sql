-- Extensions must exist before any table declares a geography/geometry column.
-- SPEC §7: Postgres + PostGIS. h3 is optional — we snap with h3-js app-side
-- (SPEC §7 "+ h3 if available, else app-side h3-js"), so it is not required here.
create extension if not exists postgis;
create extension if not exists pgcrypto;
