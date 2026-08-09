/*
# Active Postcode Areas + Waitlist

1. New Tables
   - `active_postcode_areas` — Single source of truth for which postcode outcodes
     (e.g. "ME1", "ME8") currently allow full account signup.
     - `id` (uuid, primary key)
     - `postcode_prefix` (text, not null, unique) — the outcode, e.g. "ME1"
     - `created_at` (timestamptz, default now())
   - `waitlist` — Collects emails and postcodes from users outside active areas.
     - `id` (uuid, primary key)
     - `email` (text, not null)
     - `postcode` (text, not null) — full postcode as entered
     - `postcode_prefix` (text, not null) — the outcode, e.g. "CT1"
     - `created_at` (timestamptz, default now())
     - `notified` (boolean, default false) — for future use when an area is activated

2. Seed Data
   - Inserts ME1 through ME8 into `active_postcode_areas`.

3. Security (RLS)
   - `active_postcode_areas`: Enable RLS. Allow public SELECT (TO anon, authenticated)
     so the signup page can check whether a postcode is in an active area without
     being logged in. No INSERT/UPDATE/DELETE from clients — only admin/service role.
   - `waitlist`: Enable RLS. Allow public INSERT (TO anon, authenticated) so anyone
     can join the waitlist without an account. No public SELECT — only
     admin/service role can view entries. No UPDATE or DELETE from clients.

4. Important Notes
   - The active_postcode_areas table is the single source of truth — the app
     queries it at signup time rather than hardcoding the list.
   - The waitlist INSERT policy allows anyone (including unauthenticated users)
     to add themselves to the waitlist, since they won't have an account yet.
   - No unique constraint on waitlist.email — a user may join the waitlist from
     multiple postcodes or sessions; deduplication can be handled later.
*/

-- ── 1. active_postcode_areas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_postcode_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_prefix text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE active_postcode_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active_postcode_areas_select" ON active_postcode_areas;
CREATE POLICY "active_postcode_areas_select" ON active_postcode_areas FOR SELECT
  TO anon, authenticated USING (true);

-- Seed ME1–ME8
INSERT INTO active_postcode_areas (postcode_prefix)
VALUES ('ME1'), ('ME2'), ('ME3'), ('ME4'), ('ME5'), ('ME6'), ('ME7'), ('ME8')
ON CONFLICT (postcode_prefix) DO NOTHING;

-- ── 2. waitlist ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  postcode text NOT NULL,
  postcode_prefix text NOT NULL,
  created_at timestamptz DEFAULT now(),
  notified boolean NOT NULL DEFAULT false
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_insert" ON waitlist;
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT
  TO anon, authenticated WITH CHECK (true);
