
import { randomUUID } from "crypto";

export async function POST(request) {
  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !supabaseUrl || !anonKey || !serviceKey) {
      return Response.json(
        { error: "Server configuration missing" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Please log in first" },
        { status: 401 }
      );
    }

    const authResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: anonKey,
          Authorization: authorization
        },
        cache: "no-store"
      }
    );

    if (!authResponse.ok) {
      return Response.json(
        { error: "Invalid login session" },
        { status: 401 }
      );
    }

    const user = await authResponse.json();

    if (!user.id) {
      return Response.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const amount = Number(body.amount);

    if (
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 10000 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return Response.json(
        { error: "Enter an amount between 1 and 10000" },
        { status: 400 }
      );
    }

    const orderId = randomUUID();

    const paymentResponse = await fetch(
      "https://api.nowpayments.io/v1/payment",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: "usd",
          pay_currency: "usdtbsc",
          ipn_callback_url:
            "https://crypto-mining-hub.vercel.app/api/nowpayments/ipn",
          order_id: orderId,
          order_description: "Crypto Mining Hub USDT deposit"
        }),
        cache: "no-store"
      }
    );

    const payment = await paymentResponse.json();

    if (
      !paymentResponse.ok ||
      !payment.payment_id ||
      !payment.pay_address
    ) {
      return Response.json(
        { error: "Could not create payment" },
        { status: 502 }
      );
    }

    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/transactions`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          user_id: user.id,
          type: "deposit",
          amount,
          currency: "USDT",
          network: "BEP20",
          status: "pending",
          provider_payment_id: String(payment.payment_id),
          order_id: orderId,
          pay_address: payment.pay_address,
          price_amount: amount,
          pay_currency: payment.pay_currency || "usdtbsc"
        }),
        cache: "no-store"
      }
    );

    if (!insertResponse.ok) {
      return Response.json(
        { error: "Payment created but deposit record could not be saved" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      payment_id: payment.payment_id,
      order_id: orderId,
      pay_address: payment.pay_address,
      pay_amount: payment.pay_amount,
      pay_currency: payment.pay_currency,
      payment_status: payment.payment_status
    });
  } catch (error) {
    return Response.json(
      { error: "Deposit request failed" },
      { status: 500 }
    );
  }
}
