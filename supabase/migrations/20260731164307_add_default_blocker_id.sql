/*
# Add default blocker_id to blocks table

Adds DEFAULT auth.uid() to blocker_id, matching the same safety-net pattern
already used on reports.reporter_id, so a missing blocker_id in a client insert
still satisfies the RLS check.
*/

ALTER TABLE blocks ALTER COLUMN blocker_id SET DEFAULT auth.uid();
