
-- Rename table
ALTER TABLE connections RENAME TO match_requests;

-- Rename columns
ALTER TABLE match_requests RENAME COLUMN requester_id TO from_user_id;
ALTER TABLE match_requests RENAME COLUMN addressee_id TO to_user_id;

-- Drop old policies (they may reference old column names)
DROP POLICY IF EXISTS "connections_select" ON match_requests;
DROP POLICY IF EXISTS "connections_insert" ON match_requests;
DROP POLICY IF EXISTS "connections_update" ON match_requests;
DROP POLICY IF EXISTS "connections_delete" ON match_requests;

-- Recreate policies with new column names
CREATE POLICY "match_requests_select" ON match_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "match_requests_insert" ON match_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "match_requests_update" ON match_requests FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "match_requests_delete" ON match_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Recreate indexes with new names
DROP INDEX IF EXISTS idx_connections_addressee;
DROP INDEX IF EXISTS idx_connections_requester;
CREATE INDEX IF NOT EXISTS idx_match_requests_to_user ON match_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_match_requests_from_user ON match_requests(from_user_id, status);
