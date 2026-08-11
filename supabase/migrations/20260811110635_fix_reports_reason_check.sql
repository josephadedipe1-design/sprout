/*
# Fix reports_reason_check to match actual frontend values

ReportModal.tsx sends 'inappropriate_content' and 'safety_concern' as reason
values, but the check constraint only allowed 'spam', 'harmful', 'harassment',
'privacy', 'other' — silently failing every report submitted with either of
those two reasons.

Updates the constraint to match what the frontend actually sends.
*/

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
CHECK (reason = ANY (ARRAY['spam'::text, 'harmful'::text, 'harassment'::text, 'privacy'::text, 'other'::text, 'inappropriate_content'::text, 'safety_concern'::text]));
