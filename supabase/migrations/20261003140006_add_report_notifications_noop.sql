-- Neutralized: this migration originally created a trigger calling
-- public.notify_edge_function(), which does not exist in this database.
-- Report notifications are sent directly from the client instead, via
-- sendNotificationEmail() in ReportModal.tsx. Kept as a no-op to preserve
-- migration history ordering.
SELECT 1;
