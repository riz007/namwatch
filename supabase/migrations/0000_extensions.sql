-- Extensions must exist before any table declares a geography/geometry column.
-- Postgres + PostGIS. h3 is optional — we snap with h3-js app-side
--, so it is not required here.
create extension if not exists postgis;
create extension if not exists pgcrypto;
