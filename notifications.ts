import { supabase } from '@/lib/supabase';

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification-email`;

type EmailType = 'welcome' | 'message' | 'like' | 'reply' | 'match_request';

interface EmailPayload {
  type: EmailType;
  recipientUserId: string;
  emailData: Record<string, unknown>;
}

/**
 * Fire-and-forget notification email. Non-blocking — errors are swallowed
 * so a failed email never breaks the user-facing action that triggered it.
 */
export async function sendNotificationEmail(payload: EmailPayload): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn('[notifications] email send failed:', res.status, body);
    }
  } catch (err) {
    console.warn('[notifications] email send error:', err);
  }
}

/** Truncate text to a preview-safe length. */
export function truncatePreview(text: string, max = 120): string {
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}
