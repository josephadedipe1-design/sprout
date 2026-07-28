import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "notifications@sprout-village.co.uk";
const APP_URL = "https://sprout-village.co.uk";

function emailTemplate(preview: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a1f18;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:24px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#7D3C1A 0%,#4A1E0A 100%);padding:28px 32px;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#ffffff;color:#7D3C1A;border-radius:8px;font-size:18px;font-weight:800;margin-right:10px;vertical-align:middle;">S</span>Sprout Village</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <p style="font-size:14px;color:#9a8070;margin:0 0 16px 0;">${preview}</p>
          ${bodyContent}
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;border-top:1px solid #f0ece5;">
          <p style="font-size:12px;color:#b8a090;margin:0;line-height:1.6;">You're receiving this because you have email notifications enabled in your Sprout Village settings.<br>If you'd prefer not to get these, you can turn them off in Settings → Notifications.</p>
          <p style="font-size:12px;color:#c4a090;margin:12px 0 0 0;">© 2026 Sprout Village. Made with love for parents.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { conversation_id, sender_id, body } = await req.json();

    if (!conversation_id || !sender_id || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("[send-message-notification] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch the conversation to find the other participant
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convError || !conversation) {
      console.error("[send-message-notification] Could not fetch conversation:", convError?.message);
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine the recipient (the other person in the conversation)
    const recipientId = conversation.user1_id === sender_id
      ? conversation.user2_id
      : conversation.user1_id;

    // Don't notify yourself
    if (recipientId === sender_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "self_action" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check notification preferences — only send if email_messages is true
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_messages")
      .eq("user_id", recipientId)
      .maybeSingle();

    if (prefs && prefs.email_messages === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "notification_pref_off" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get recipient's email and first name
    const { data: recipientUser, error: recipientError } = await supabase.auth.admin.getUserById(recipientId);
    if (recipientError || !recipientUser?.user?.email) {
      console.error("[send-message-notification] Could not fetch recipient email:", recipientError?.message);
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", recipientId)
      .maybeSingle();

    const recipientName = recipientProfile?.first_name || "there";

    // 4. Build email — first 100 chars of message body as preview
    const messagePreview = body.length > 100 ? body.slice(0, 100) + "…" : body;

    const subject = "You have a new message on Sprout Village";
    const bodyContent = `
      <h1 style="font-size:20px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">You have a new message</h1>
      <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0 0 16px 0;">Hi ${recipientName}, you've received a new message on Sprout Village.</p>
      <div style="background-color:#faf8f6;border-radius:12px;padding:16px 20px;margin:0 0 24px 0;">
        <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0;">${messagePreview}</p>
      </div>
      <a href="${APP_URL}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">Read & reply in Sprout Village</a>`;

    // 5. Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientUser.user.email],
        subject,
        html: emailTemplate("You have a new message on Sprout Village", bodyContent),
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[send-message-notification] Resend API error:", errText);
      return new Response(JSON.stringify({ error: "Resend API error", details: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ sent: true, id: result.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-message-notification] Unhandled error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
