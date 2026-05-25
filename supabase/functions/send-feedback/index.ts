import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeedbackRequest {
  name: string;
  email: string;
  message: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// In-memory rate limiter (best-effort; per edge isolate)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(clientIP);
    if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS) {
      if (entry.count >= RATE_LIMIT_MAX) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      entry.count++;
    } else {
      rateLimitMap.set(clientIP, { count: 1, windowStart: now });
    }

    const { name, email, message }: FeedbackRequest = await req.json();

    if (!name || !message || typeof name !== "string" || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Name and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    const trimmedEmail = (email || "").trim();

    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return new Response(
        JSON.stringify({ error: "Name must be 1-100 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (trimmedMessage.length === 0 || trimmedMessage.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message must be 1-2000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (trimmedEmail && (trimmedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const safeName = escapeHtml(trimmedName);
    const safeEmail = escapeHtml(trimmedEmail || "Not provided");
    const safeMessage = escapeHtml(trimmedMessage).replace(/\n/g, "<br>");

    const emailResponse = await resend.emails.send({
      from: "TicTacToe Feedback <onboarding@resend.dev>",
      to: ["biggestkvng@gmail.com"],
      subject: `TicTacToe Feedback from ${trimmedName.slice(0, 80)}`,
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <hr />
        <h3>Message:</h3>
        <p>${safeMessage}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">This feedback was sent from the TicTacToe game.</p>
      `,
    });

    console.log("Feedback email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-feedback function:", {
      message: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Failed to send feedback. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
