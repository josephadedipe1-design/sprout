/*
# Fix edge function trigger auth

## Purpose
The edge functions have JWT verification enabled. Database triggers call
these functions via pg_net, but can't provide a user JWT. We have two options:
1. Disable JWT verification on the notification edge functions (they're
   called internally by DB triggers, not from the client)
2. Pass the anon key as Authorization header

We choose option 1: the edge functions will have verifyJWT=false since they
are only callable from DB triggers (which already operate with elevated
privileges). The functions themselves use the service role key internally
to look up user data, so they don't rely on the caller's JWT for auth.

## Changes
- Updated `notify_edge_function` to include the anon key in the Authorization
  header so the edge functions can verify the JWT (they'll be redeployed with
  verify_jwt=false anyway, but including the header is belt-and-suspenders)
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
  v_anon_key := current_setting('app.supabase_anon_key', true);

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
      ),
      body := p_payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notify_edge_function failed for %: %', p_function_slug, SQLERRM;
  END;
END;
$$;
