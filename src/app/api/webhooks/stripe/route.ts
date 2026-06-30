import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event as any;
        const userId = session?.data?.object?.metadata?.user_id;
        const planId = session?.data?.object?.metadata?.plan_id;
        if (userId && planId) {
          await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
            method: "POST", headers,
            body: JSON.stringify({
              user_id: userId, plan_id: planId,
              status: "active", stripe_subscription_id: session?.data?.object?.subscription,
            }),
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event as any;
        const subId = sub?.data?.object?.id;
        if (subId) {
          await fetch(
            `${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${subId}`,
            { method: "PATCH", headers, body: JSON.stringify({ status: "cancelled" }) }
          );
        }
        break;
      }
    }
  } catch (e) { console.error("Stripe webhook error:", e); }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
