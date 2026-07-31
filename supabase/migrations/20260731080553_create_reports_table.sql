/*
# Create reports table for user reporting feature

1. New Tables
- `reports`
  - `id` (uuid, primary key, auto-generated)
  - `reporter_id` (uuid, not null, references profiles) — the user submitting the report
  - `reported_user_id` (uuid, nullable, references profiles) — the user being reported (for profile reports)
  - `reported_post_id` (uuid, nullable, references posts) — the post being reported (for post reports)
  - `reported_message_id` (uuid, nullable, references messages) — the message being reported (for message reports)
  - `reason` (text, not null) — one of: 'spam', 'harassment', 'inappropriate_content', 'safety_concern', 'other'
  - `details` (text, nullable) — optional free-text explanation from the reporter
  - `status` (text, not null, default 'pending') — one of: 'pending', 'reviewed', 'dismissed', 'action_taken'
  - `created_at` (timestamptz, default now())

2. Security (RLS)
- RLS enabled on `reports`.
- SELECT: users can only see reports they submitted (reporter_id = auth.uid()).
  They cannot see reports other people filed about them or anyone else.
- INSERT: authenticated users can insert a report where reporter_id = auth.uid().
  The reporter_id column defaults to auth.uid() so client inserts that omit it still succeed.
- No UPDATE or DELETE policies for regular users — reports are immutable once submitted.
  Only admins/service roles (which bypass RLS) can update status or delete.

3. Important Notes
- The `reporter_id` column has DEFAULT auth.uid() so frontend inserts that omit it
  still satisfy the INSERT WITH CHECK (auth.uid() = reporter_id) policy.
- At least one of reported_user_id / reported_post_id / reported_message_id should be
  populated by the caller depending on what is being reported; this is enforced in app
  logic, not at the DB level (to keep the table flexible).
- Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reported_post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  reported_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
