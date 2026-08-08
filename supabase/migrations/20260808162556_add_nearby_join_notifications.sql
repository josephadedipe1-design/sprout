/*
# Add nearby-join notifications

1. New Tables
   - `nearby_join_notifications` — Stores "new parents joined near you"
     notifications for existing users when a new user signs up within 10 miles.
   - `id` (uuid, primary key)
   - `user_id` (uuid, not null, references auth.users) — the recipient (existing user)
   - `new_user_id` (uuid, references auth.users) — the new user who triggered the notification
   - `join_count` (integer, default 1) — how many new parents joined (batched per day)
   - `read` (boolean, default false) — whether the recipient has seen it
   - `notification_date` (date, not null, default CURRENT_DATE) — for daily batching
   - `created_at`, `updated_at` (timestamptz)

2. Indexes
   - Unique index on (user_id, notification_date) — ensures at most one notification
     per user per day. Multiple new users joining on the same day increment join_count
     via ON CONFLICT instead of creating new rows.

3. Trigger
   - `trigger_nearby_join_notification` — fires AFTER INSERT on `profiles`.
     When a new user with lat/lng signs up, finds all existing profiles within
     10 miles (16.0934 km) using the haversine formula and upserts a notification
     for each. Uses ON CONFLICT (user_id, notification_date) to batch: if a
     notification already exists for today, increments join_count and marks
     unread again.

4. Security (RLS)
   - Enable RLS on `nearby_join_notifications`.
   - SELECT: users can only read their own notifications (user_id = auth.uid()).
   - UPDATE: users can only update their own notifications (to mark as read).
   - No INSERT or DELETE from clients — only the trigger inserts.

5. Important Notes
   - The trigger runs as SECURITY DEFINER to bypass RLS and query all profiles.
   - The haversine formula uses least(1, greatest(-1, ...)) clamp to avoid
     acos domain errors from floating-point imprecision.
   - The 10-mile radius matches the existing Discovery feature in MatchingView.
*/

-- ── 1. Create table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nearby_join_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  join_count integer NOT NULL DEFAULT 1,
  read boolean NOT NULL DEFAULT false,
  notification_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nearby_join_notif_user_date
  ON nearby_join_notifications (user_id, notification_date);

CREATE INDEX IF NOT EXISTS idx_nearby_join_notif_user_read
  ON nearby_join_notifications (user_id, read);

-- ── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE nearby_join_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nearby_join_notif_select" ON nearby_join_notifications;
CREATE POLICY "nearby_join_notif_select" ON nearby_join_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "nearby_join_notif_update" ON nearby_join_notifications;
CREATE POLICY "nearby_join_notif_update" ON nearby_join_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. Trigger function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_nearby_join_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if the new user has lat/lng
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert or update a notification for each existing user within 10 miles
  INSERT INTO nearby_join_notifications (user_id, new_user_id, join_count, notification_date)
  SELECT
    p.id,
    NEW.id,
    1,
    CURRENT_DATE
  FROM profiles p
  WHERE p.id <> NEW.id
    AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND 6371 * acos(
      least(1, greatest(-1,
        cos(radians(p.lat)) * cos(radians(NEW.lat)) * cos(radians(p.lng) - radians(NEW.lng)) +
        sin(radians(p.lat)) * sin(radians(NEW.lat))
      ))
    ) <= 16.0934
  ON CONFLICT (user_id, notification_date) DO UPDATE SET
    join_count = nearby_join_notifications.join_count + 1,
    read = false,
    updated_at = now(),
    new_user_id = EXCLUDED.new_user_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigger_nearby_join_notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 4. Attach trigger ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_profile_insert_nearby_join ON profiles;
CREATE TRIGGER on_profile_insert_nearby_join
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_nearby_join_notification();
