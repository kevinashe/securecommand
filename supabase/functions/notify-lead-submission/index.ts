import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LeadNotification {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  product_interest?: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const lead: LeadNotification = await req.json();

    console.log("New lead submission:", {
      name: lead.name,
      email: lead.email,
      company: lead.company || "Not provided",
    });

    const emailBody = `
New Lead Submission

Contact Information:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company || "Not provided"}
- Phone: ${lead.phone || "Not provided"}

Product Interest:
${lead.product_interest || "Not specified"}

Message:
${lead.message}

---
Submitted at: ${new Date().toLocaleString()}
    `;

    console.log("Email notification prepared:", emailBody);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead notification processed",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing lead notification:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});