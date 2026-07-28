/*
# Create user_interests and notification_preferences tables

## Purpose
Normalizes interests out of the profiles table into a separate user_interests
table, and creates a dedicated notification_preferences table for email
notification opt-in/opt-out per category.

## New Tables
1. user_interests
   - user_id (uuid, FK to profiles.id ON DELETE CASCADE)
   - interest (text)
   - Primary key: composite (user_id, interest)
   - Index on user_id for fast lookups

2. notification_preferences
   - user_id (uuid, FK to profiles.id ON DELETE CASCADE, primary key)
   - email_replies (boolean, default true)
   - email_matches (boolean, default true)
   - email_messages (boolean, default true)
   - email_connections (boolean, default true)
   - created_at, updated_at timestamps

## Security
- RLS enabled on both tables
- Owner-scoped CRUD policies (authenticated users can only access their own rows)
- For user_interests: SELECT is TO authenticated so users can see other users' interests
  (needed for matching/profile views). INSERT/UPDATE/DELETE are owner-scoped.
- For notification_preferences: fully owner-scoped (users only see/edit their own prefs)
*/

-- ── user_interests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_interests (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest text NOT NULL,
  PRIMARY KEY (user_id, interest)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read interests (needed for profile/matching views)
DROP POLICY IF EXISTS "read_user_interests" ON user_interests;
CREATE POLICY "read_user_interests"
ON user_interests FOR SELECT
TO authenticated USING (true);

-- Only the owner can insert their own interests
DROP POLICY IF EXISTS "insert_own_interests" ON user_interests;
CREATE POLICY "insert_own_interests"
ON user_interests FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only the owner can delete their own interests
DROP POLICY IF EXISTS "delete_own_interests" ON user_interests;
CREATE POLICY "delete_own_interests"
ON user_interests FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ── notification_preferences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email_replies boolean NOT NULL DEFAULT true,
  email_matches boolean NOT NULL DEFAULT true,
  email_messages boolean NOT NULL DEFAULT true,
  email_connections boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_prefs" ON notification_preferences;
CREATE POLICY "select_own_notification_prefs"
ON notification_preferences FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notification_prefs" ON notification_preferences;
CREATE POLICY "insert_own_notification_prefs"
ON notification_preferences FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notification_prefs" ON notification_preferences;
CREATE POLICY "update_own_notification_prefs"
ON notification_preferences FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notification_prefs" ON notification_preferences;
CREATE POLICY "delete_own_notification_prefs"
ON notification_preferences FOR DELETE
TO authenticated USING (auth.uid() = user_id);
