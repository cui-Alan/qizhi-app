import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
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
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        if (userId && planId) {
          await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
            method: "POST", headers,
            body: JSON.stringify({
              user_id: userId, plan_id: planId,
              status: "active", stripe_subscription_id: session.subscription,
            }),
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${sub.id}`,
          { method: "PATCH", headers, body: JSON.stringify({ status: "cancelled" }) }
        );
        break;
      }
    }
  } catch (e) { console.error("Stripe webhook error:", e); }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
