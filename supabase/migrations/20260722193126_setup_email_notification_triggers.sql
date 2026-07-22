/*
# Email Notification Triggers

## Purpose
Sets up database triggers that fire HTTP requests to Supabase Edge Functions
whenever a relevant row is inserted or updated. The edge functions then send
transactional notification emails via Resend.

## Changes
1. Extensions
   - Install `pg_net` (async HTTP client for PostgreSQL) in the `extensions` schema.

2. Helper Function: `notify_edge_function(payload jsonb, function_slug text)`
   - Sends an async POST request to the specified edge function endpoint.
   - Uses the Supabase anon key for auth (edge functions verify JWT but the
     service role key is also accepted).
   - Errors are caught and logged via `RAISE NOTICE` so the trigger never
     blocks the originating DML.

3. Triggers
   - `on_reply_insert` — AFTER INSERT on `replies` → calls `send-reply-notification`
   - `on_match_request_insert` — AFTER INSERT on `match_requests` (status='pending') → calls `send-match-notification`
   - `on_match_request_update` — AFTER UPDATE on `match_requests` (status changed to 'connected') → calls `send-connection-accepted`
   - `on_message_insert` — AFTER INSERT on `messages` → calls `send-message-notification`

## Security
   - The helper function runs with SECURITY DEFINER (as the migration owner)
     so it can access the `pg_net` extension and vault secrets.
   - No new tables are created.
   - No RLS changes — triggers operate at the database level, not through RLS.

## Notes
   - `pg_net` sends requests asynchronously — the trigger does not block on
     the HTTP response.
   - If an edge function is unreachable, `pg_net` silently fails and the
     trigger completes normally (the DML is not rolled back).
   - Edge functions handle their own error logging and preference checking.
*/

-- ── 1. Install pg_net ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ── 2. Helper function ────────────────────────────────────────────────────
-- Posts JSON to an edge function endpoint asynchronously. Never throws.
CREATE OR REPLACE FUNCTION public.notify_edge_function(
  p_payload jsonb,
  p_function_slug text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_base_url text;
  v_anon_key text;
  v_url text;
BEGIN
  -- Derive the Supabase project URL from the function endpoint
  -- The API URL is: <project_url>/functions/v1/<slug>
  -- We use the anon key from the vault (pg_net needs auth for JWT-verified functions)
  SELECT value INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_ANON_KEY'
    LIMIT 1;

  -- Fallback: use the known project URL pattern
  -- The supabase admin API base is available via current_setting
  v_base_url := current_setting('app.supabase_url', true);
  IF v_base_url IS NULL OR v_base_url = '' THEN
    -- Fallback: derive from the API host
    v_base_url := 'https://noleulwvcsxkqpesdanx.supabase.co';
  END IF;

  v_url := v_base_url || '/functions/v1/' || p_function_slug;

  -- Send async POST — errors are swallowed so triggers never block DML
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

GRANT EXECUTE ON FUNCTION public.notify_edge_function(jsonb, text) TO authenticated;

-- ── 3. Trigger functions ─────────────────────────────────────────────────

-- Reply insert → send-reply-notification
CREATE OR REPLACE FUNCTION public.trigger_reply_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_edge_function(
    jsonb_build_object(
      'reply_id', NEW.id,
      'post_id', NEW.post_id,
      'author_id', NEW.author_id,
      'body', NEW.body
    ),
    'send-reply-notification'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigger_reply_notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Match request insert → send-match-notification
CREATE OR REPLACE FUNCTION public.trigger_match_request_insert_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.notify_edge_function(
      jsonb_build_object(
        'request_id', NEW.id,
        'from_user_id', NEW.from_user_id,
        'to_user_id', NEW.to_user_id
      ),
      'send-match-notification'
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigger_match_request_insert_notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Match request update → send-connection-accepted
CREATE OR REPLACE FUNCTION public.trigger_match_request_update_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'connected' AND NEW.status = 'connected' THEN
    PERFORM public.notify_edge_function(
      jsonb_build_object(
        'request_id', NEW.id,
        'from_user_id', NEW.from_user_id,
        'to_user_id', NEW.to_user_id,
        'status', NEW.status
      ),
      'send-connection-accepted'
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigger_match_request_update_notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Message insert → send-message-notification
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_edge_function(
    jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'body', NEW.body
    ),
    'send-message-notification'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigger_message_notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 4. Attach triggers ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_reply_insert ON replies;
CREATE TRIGGER on_reply_insert
  AFTER INSERT ON replies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reply_notification();

DROP TRIGGER IF EXISTS on_match_request_insert ON match_requests;
CREATE TRIGGER on_match_request_insert
  AFTER INSERT ON match_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_request_insert_notification();

DROP TRIGGER IF EXISTS on_match_request_update ON match_requests;
CREATE TRIGGER on_match_request_update
  AFTER UPDATE ON match_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_request_update_notification();

DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_notification();
