/*
# Add children table

Moves child age data out of the profiles.children_ages array into a dedicated table.
Each child is a separate row, allowing richer queries and cleaner data modelling.

1. New Tables
   - `children`
     - `id` (uuid, primary key)
     - `user_id` (uuid, FK to auth.users, owner of the child record, defaults to auth.uid())
     - `age_months` (integer, the child's age in whole months e.g. 0 = under 1 year, 12 = 1 year, 24 = 2 years)
     - `created_at` (timestamp)

2. Security
   - RLS enabled.
   - All authenticated users can SELECT (needed so matching/discover cards can display children ages).
   - Only the owner (user_id = auth.uid()) can INSERT, UPDATE, DELETE their own children rows.

3. Notes
   - The existing profiles.children_ages column is left in place for backward compatibility with existing data.
     New signups will no longer populate it; display code reads from this table instead.
   - age_months values correspond to the signup picker labels:
     0 = "Under 1 year", 12 = "1 year", 24 = "2 years", 36 = "3 years", 48 = "4 years", 60 = "5 years"
*/

CREATE TABLE IF NOT EXISTS children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  age_months integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_children_user_id ON children(user_id);

DROP POLICY IF EXISTS "children_select" ON children;
CREATE POLICY "children_select" ON children FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "children_insert" ON children;
CREATE POLICY "children_insert" ON children FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "children_update" ON children;
CREATE POLICY "children_update" ON children FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "children_delete" ON children;
CREATE POLICY "children_delete" ON children FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
