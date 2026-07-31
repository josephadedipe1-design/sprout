/*
# Admin moderation access to reports table

## 1. RLS changes on `reports`
- SELECT: regular users still see only their own submitted reports
  (reporter_id = auth.uid()). The admin user (4848415f-2bbe-409a-8443-eb925b0b88e8)
  can SELECT all rows.
- UPDATE: previously no UPDATE policy existed (reports were immutable for regular
  users). We add an UPDATE policy that allows ONLY the admin to update the status
  column on any report. Regular users still cannot update reports.
- INSERT and DELETE policies are unchanged.

## 2. Important Notes
- The admin user ID is hardcoded to 4848415f-2bbe-409a-8443-eb925b0b88e8, matching
  the existing Broadcast admin screen pattern.
- Idempotent: uses DROP POLICY IF EXISTS before recreating.
*/

-- SELECT: admin sees all reports, regular users see only their own.
DROP POLICY IF EXISTS "select_own_reports" ON reports;
DROP POLICY IF EXISTS "select_admin_all_reports" ON reports;
CREATE POLICY "select_reports" ON reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8'
  );

-- UPDATE: only the admin can update reports (e.g. change status).
DROP POLICY IF EXISTS "update_admin_reports" ON reports;
CREATE POLICY "update_admin_reports" ON reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8')
  WITH CHECK (auth.uid() = '4848415f-2bbe-409a-8443-eb925b0b88e8');
