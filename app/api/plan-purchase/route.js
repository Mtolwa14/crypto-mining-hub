
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const plans = {
  STARTER: 10,
  BASIC: 25,
  PRO: 50,
  PREMIUM: 100,
  GOLD: 250,
  PLATINUM: 500,
  DIAMOND: 1000,
  VIP: 2000,
};

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!supabaseUrl || !anonKey || !serviceKey || !nowPaymentsKey || !siteUrl) {
      return NextResponse.json(
        {
          error: "Missing server configuration.",
          details: "Check the required environment variables in Vercel.",
        },
        { status: 500 }
      );
    }

    let callbackUrl;

    try {
      const baseUrl = new URL(siteUrl);
      if (baseUrl.protocol !== "https:") {
        throw new Error("HTTPS is required.");
      }
      callbackUrl = `${baseUrl.origin}/api/nowpayments/ipn`;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid website URL configuration.",
          details: "Check NEXT_PUBLIC_SITE_URL in Vercel.",
        },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Your login session is invalid." },
        { status: 401 }
      );
    }

    const user = await userResponse.json();
    const body = await request.json();

    const planName = String(body.plan_name || "").toUpperCase();
    const price = plans[planName];

    if (!price) {
      return NextResponse.json(
        { error: "Invalid investment plan." },
        { status: 400 }
      );
    }

    const orderId = `CMH-${crypto.randomUUID()}`;

    const paymentResponse = await fetch(
      "https://api.nowpayments.io/v1/payment",
      {
        method: "POST",
        headers: {
          "x-api-key": nowPaymentsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: price,
          price_currency: "usd",
          pay_currency: "usdtbsc",
          ipn_callback_url: callbackUrl,
          order_id: orderId,
          order_description: `${planName} Plan Payment`,
        }),
        cache: "no-store",
      }
    );

    const responseText = await paymentResponse.text();

    let payment;

    try {
      payment = JSON.parse(responseText);
    } catch {
      payment = { message: responseText };
    }

    if (!paymentResponse.ok || !payment.payment_id) {
      console.error("NOWPayments rejected payment:", {
        status: paymentResponse.status,
        response: payment,
      });

      return NextResponse.json(
        {
          error: "NOWPayments could not create the payment.",
          details:
            payment.message ||
            payment.error ||
            JSON.stringify(payment).slice(0, 500),
          provider_status: paymentResponse.status,
        },
        { status: 502 }
      );
    }

    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/mining_plan_purchases`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: user.id,
          plan_name: planName,
          price_usdt: price,
          principal_usdt: null,
          currency: "USDT",
          network: "BEP20",
          status: "pending",
          provider: "NOWPayments",
          provider_payment_id: String(payment.payment_id),
          order_id: orderId,
          pay_address: payment.pay_address,
          pay_currency: payment.pay_currency,
          expected_pay_amount: payment.pay_amount,
        }),
        cache: "no-store",
      }
    );

    if (!insertResponse.ok) {
      const dbError = await insertResponse.text();

      console.error("Supabase order save error:", dbError);

      return NextResponse.json(
        {
          error: "Payment was created but the order could not be saved.",
          details: "Contact support before making any payment.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: planName,
      price_usdt: price,
      payment_id: payment.payment_id,
      pay_address: payment.pay_address,
      pay_amount: payment.pay_amount,
      pay_currency: payment.pay_currency,
      order_id: orderId,
      message: "Payment created. Wait for payment confirmation.",
    });
  } catch (error) {
    console.error("Plan purchase server error:", error);

    return NextResponse.json(
      {
        error: "An unexpected server error occurred.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
