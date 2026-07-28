
-- Rename comments to replies
ALTER TABLE comments RENAME TO replies;

-- Rename columns to match new schema
ALTER TABLE replies RENAME COLUMN user_id TO author_id;
ALTER TABLE replies RENAME COLUMN content TO body;

-- Drop and recreate RLS policies with new column names
DROP POLICY IF EXISTS "comments_select" ON replies;
DROP POLICY IF EXISTS "comments_insert" ON replies;
DROP POLICY IF EXISTS "comments_update" ON replies;
DROP POLICY IF EXISTS "comments_delete" ON replies;
DROP POLICY IF EXISTS "replies_select" ON replies;
DROP POLICY IF EXISTS "replies_insert" ON replies;
DROP POLICY IF EXISTS "replies_update" ON replies;
DROP POLICY IF EXISTS "replies_delete" ON replies;

CREATE POLICY "replies_select" ON replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "replies_insert" ON replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "replies_update" ON replies FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "replies_delete" ON replies FOR DELETE TO authenticated USING (auth.uid() = author_id);
