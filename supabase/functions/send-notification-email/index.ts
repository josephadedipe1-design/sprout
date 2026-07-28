import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Sprout <noreply@sprout-village.co.uk>";

function htmlTemplate(title: string, preview: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2a1f18;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7D3C1A 0%,#4A1E0A 100%);padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#ffffff;color:#7D3C1A;border-radius:8px;font-size:18px;font-weight:800;margin-right:10px;vertical-align:middle;">S</span>Sprout Village</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:14px;color:#9a8070;margin:0 0 16px 0;">${preview}</p>
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #f0ece5;">
              <p style="font-size:12px;color:#b8a090;margin:0;line-height:1.6;">
                You're receiving this because you have email notifications enabled in your Sprout settings.
                <br>If you'd prefer not to get these, you can turn them off in Settings → Notifications.
              </p>
              <p style="font-size:12px;color:#c4a090;margin:12px 0 0 0;">© 2026 Sprout. Made with love for parents.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailContent(type: string, data: Record<string, unknown>): { subject: string; html: string } {
  const recipientName = (data.recipientName as string) || "there";

  switch (type) {
    case "welcome": {
      const subject = "Welcome to Sprout 🌱";
      const body = `
        <h1 style="font-size:24px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">Welcome${recipientName !== "there" ? `, ${recipientName}` : ""}!</h1>
        <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0 0 16px 0;">
          You're officially part of the Sprout community — a local space for parents to connect, share, and grow together.
        </p>
        <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0 0 24px 0;">
          Here's what you can do next:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="padding:8px 0;font-size:15px;color:#5a4035;">🤝 <strong>Find parents near you</strong> — match with parents at the same stage</td></tr>
          <tr><td style="padding:8px 0;font-size:15px;color:#5a4035;">💬 <strong>Join the community feed</strong> — share posts, ask questions, get support</td></tr>
          <tr><td style="padding:8px 0;font-size:15px;color:#5a4035;">🛍️ <strong>Browse the marketplace</strong> — find and list items nearby</td></tr>
        </table>
        <a href="${data.appUrl || "https://sprout-village.co.uk"}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">Open Sprout</a>`;
      return { subject, html: htmlTemplate(subject, "Welcome to the Sprout community", body) };
    }

    case "message": {
      const senderName = (data.senderName as string) || "Someone";
      const preview = (data.preview as string) || "";
      const subject = `${senderName} sent you a message`;
      const body = `
        <h1 style="font-size:20px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">${senderName} sent you a message</h1>
        <div style="background-color:#faf8f6;border-radius:12px;padding:16px 20px;margin:0 0 24px 0;">
          <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0;">${preview}</p>
        </div>
        <a href="${data.appUrl || "https://sprout-village.co.uk"}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">Reply in Sprout</a>`;
      return { subject, html: htmlTemplate(subject, `${senderName} sent you a message`, body) };
    }

    case "like": {
      const likerName = (data.likerName as string) || "Someone";
      const postPreview = (data.postPreview as string) || "your post";
      const subject = `${likerName} liked your post`;
      const body = `
        <h1 style="font-size:20px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">${likerName} liked your post ❤️</h1>
        <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0 0 16px 0;">
          <em>"${postPreview}"</em>
        </p>
        <a href="${data.appUrl || "https://sprout-village.co.uk"}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">View your post</a>`;
      return { subject, html: htmlTemplate(subject, `${likerName} liked your post`, body) };
    }

    case "reply": {
      const replierName = (data.replierName as string) || "Someone";
      const replyPreview = (data.replyPreview as string) || "";
      const postPreview = (data.postPreview as string) || "your post";
      const subject = `${replierName} replied to your post`;
      const body = `
        <h1 style="font-size:20px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">${replierName} replied to your post</h1>
        <p style="font-size:13px;color:#9a8070;margin:0 0 12px 0;">In response to: <em>"${postPreview}"</em></p>
        <div style="background-color:#faf8f6;border-radius:12px;padding:16px 20px;margin:0 0 24px 0;">
          <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0;">${replyPreview}</p>
        </div>
        <a href="${data.appUrl || "https://sprout-village.co.uk"}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">View the conversation</a>`;
      return { subject, html: htmlTemplate(subject, `${replierName} replied to your post`, body) };
    }

    case "match_request": {
      const requesterName = (data.requesterName as string) || "A parent";
      const subject = `${requesterName} wants to connect with you`;
      const body = `
        <h1 style="font-size:20px;font-weight:700;color:#2a1f18;margin:0 0 12px 0;">${requesterName} wants to connect 🤝</h1>
        <p style="font-size:15px;line-height:1.6;color:#5a4035;margin:0 0 24px 0;">
          They saw your profile and would love to connect. Head to Sprout to accept their request and start chatting.
        </p>
        <a href="${data.appUrl || "https://sprout-village.co.uk"}" style="display:inline-block;background-color:#7D3C1A;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">View request</a>`;
      return { subject, html: htmlTemplate(subject, `${requesterName} wants to connect`, body) };
    }

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { type, recipientUserId, emailData } = await req.json();

    if (!type || !recipientUserId || !emailData) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, recipientUserId, emailData" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to look up recipient email + settings (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get recipient's email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipientUserId);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Could not find recipient email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check notification preferences — skip if the relevant pref is off
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_replies, email_matches, email_messages, email_connections")
      .eq("user_id", recipientUserId)
      .maybeSingle();

    if (prefs) {
      const prefMap: Record<string, keyof typeof prefs> = {
        message: "email_messages",
        like: "email_replies",
        reply: "email_replies",
        match_request: "email_matches",
      };
      const prefKey = prefMap[type];
      if (prefKey && prefs[prefKey] === false) {
        return new Response(JSON.stringify({ skipped: true, reason: "notification_pref_off" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Don't send notification to yourself
    const actorUserId = emailData.actorUserId as string | undefined;
    if (actorUserId && actorUserId === recipientUserId) {
      return new Response(JSON.stringify({ skipped: true, reason: "self_action" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildEmailContent(type, emailData);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [userData.user.email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return new Response(JSON.stringify({ error: "Resend API error", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ sent: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
