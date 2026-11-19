
import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIN_WITHDRAWAL = 10;

export async function POST(req) {
  try {
    if (!URL || !ANON || !SERVICE) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const auth = req.headers.get("authorization");

    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please login again." },
        { status: 401 }
      );
    }

    const token = auth.substring(7);

    const authRes = await fetch(`${URL}/auth/v1/user`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const user = await authRes.json();
    const body = await req.json();

    const amount = Number(body.amount);
    const wallet = String(body.wallet_address || "").trim();

    if (
      !Number.isFinite(amount) ||
      amount < MIN_WITHDRAWAL ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
      return NextResponse.json(
        { error: "Minimum withdrawal is 10 USDT. Enter a valid amount." },
        { status: 400 }
      );
    }

    if (
      wallet.length < 20 ||
      wallet.length > 150 ||
      /\s/.test(wallet)
    ) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400 }
      );
    }

    const headers = {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    };

    // Confirm the user has an active mining plan.
    const planRes = await fetch(
      `${URL}/rest/v1/mining_plan_purchases?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=id&limit=1`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!planRes.ok) {
      return NextResponse.json(
        { error: "Unable to verify active mining plan." },
        { status: 500 }
      );
    }

    const plans = await planRes.json();

    if (!plans.length) {
      return NextResponse.json(
        { error: "An active mining plan is required." },
        { status: 403 }
      );
    }

    // Atomically check balance, deduct funds and create withdrawal.
    const withdrawalRes = await fetch(
      `${URL}/rest/v1/rpc/create_secure_withdrawal`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          p_user_id: user.id,
          p_amount: amount,
          p_wallet_address: wallet,
        }),
      }
    );

    const resultText = await withdrawalRes.text();

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = null;
    }

    if (!withdrawalRes.ok) {
      const message =
        result?.message ||
        result?.details ||
        "Unable to process withdrawal.";

      const status =
        message.includes("already have a pending") ? 409 :
        message.includes("Insufficient wallet balance") ? 400 :
        message.includes("Minimum withdrawal") ? 400 :
        message.includes("Invalid wallet") ? 400 : 500;

      return NextResponse.json(
        { error: message },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      withdrawal: result,
      message: "Withdrawal submitted successfully. Awaiting admin review.",
    });
  } catch (error) {
    console.error("Withdrawal error:", error);

    return NextResponse.json(
      { error: "Server error processing withdrawal." },
      { status: 500 }
    );
  }
}
