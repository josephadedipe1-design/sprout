/*
# Report notifications — NOT applied via database trigger

The original version of this migration created a trigger calling
notify_edge_function(), but that function does not exist in the live
database (the July 22 migrations that were meant to create it were never
successfully applied, despite being present in the migrations folder).

Report notifications are instead sent directly from ReportModal.tsx via
sendNotificationEmail(), matching the pattern already used for every other
notification type in this app (message, reply, like, message_request) —
none of which use database triggers.

This file intentionally does nothing.
*/

SELECT 1;
