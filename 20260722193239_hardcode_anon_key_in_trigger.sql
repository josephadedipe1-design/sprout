/*
# Hardcode anon key in notify_edge_function

## Purpose
ALTER DATABASE / ALTER ROLE SET for custom config params is blocked by permissions.
The anon key is already public (embedded in the frontend .env), so we hardcode
it directly in the helper function. This is safe — the anon key is designed to
be client-visible.

## Changes
- Replaces `current_setting()` lookup with a hardcoded anon key constant
*/

CREATE OR REPLACE FUNCTION public.notify_edge_function(
  p_payload jsonb,
  p_function_slug text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  v_url := 'https://noleulwvcsxkqpesdanx.supabase.co/functions/v1/' || p_function_slug;
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbGV1bHd2Y3N4a3FwZXNkYW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDE5MjEsImV4cCI6MjA5ODkxNzkyMX0.hls6LWZspTlQTW3KiGRUVICIYA5A6GKM0ZL36Gcwzcg';

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := p_payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notify_edge_function failed for %: %', p_function_slug, SQLERRM;
  END;
END;
$$;
