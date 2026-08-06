/*
# Add missing DELETE policy on match_requests

match_requests has RLS enabled with INSERT/SELECT/UPDATE policies but no
DELETE policy — meaning "cancel sent request" (MatchingView.tsx
cancelSentRequest) silently affects zero rows rather than erroring, so a
cancelled request reappears after refresh.

Adds a DELETE policy allowing the sender to delete their own sent request.
*/

CREATE POLICY "match_requests_delete_own" ON match_requests FOR DELETE
TO authenticated
USING (auth.uid() = from_user_id);
