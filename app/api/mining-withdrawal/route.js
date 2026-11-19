import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIN_WITHDRAWAL = 10;
const CURRENCY = "USDT";
const NETWORK = "BEP20";

export async function POST(req) {
  try {
    if (!URL || !ANON || !SERVICE) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    // 1. Verify login
    const auth = req.headers.get("authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
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

    // 2. Read withdrawal details
    const body = await req.json();

    const amount = Number(body.amount);
    const wallet = String(body.wallet_address || "").trim();

    // 3. Validate amount
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: "Minimum withdrawal is 10 USDT." },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(Math.round(amount * 100))) {
      return NextResponse.json(
        { error: "Invalid withdrawal amount." },
        { status: 400 }
      );
    }

    // 4. Validate wallet address
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

    // 5. Verify active mining plan
    const planRes = await fetch(
      `${URL}/rest/v1/mining_plan_purchases?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=id&limit=1`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!planRes.ok) {
      return NextResponse.json(
        { error: "Unable to verify active plan." },
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

    // 6. Prevent multiple pending requests
    const pendingRes = await fetch(
      `${URL}/rest/v1/mining_withdrawals?user_id=eq.${encodeURIComponent(user.id)}&status=eq.Pending%20Review&select=id&limit=1`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!pendingRes.ok) {
      return NextResponse.json(
        { error: "Unable to check pending withdrawals." },
        { status: 500 }
      );
    }

    const pending = await pendingRes.json();

    if (pending.length > 0) {
      return NextResponse.json(
        {
          error:
            "You already have a pending withdrawal. Wait for it to be reviewed.",
        },
        { status: 409 }
      );
    }

    // 7. Save withdrawal request
    const saveRes = await fetch(
      `${URL}/rest/v1/mining_withdrawals`,
      {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: user.id,
          amount,
          currency: CURRENCY,
          network: NETWORK,
          wallet_address: wallet,
          status: "Pending Review",
        }),
      }
    );

    const resultText = await saveRes.text();

    let result = [];

    try {
      result = JSON.parse(resultText);
    } catch {
      result = [];
    }

    if (!saveRes.ok) {
      return NextResponse.json(
        { error: "Unable to submit withdrawal request." },
        { status: 500 }
      );
    }

    // 8. Success
    return NextResponse.json({
      success: true,
      withdrawal: result?.[0] || null,
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