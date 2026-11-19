import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const token = auth.slice(7);

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

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid withdrawal amount." },
        { status: 400 }
      );
    }

    if (wallet.length < 20 || wallet.length > 150) {
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

    const planRes = await fetch(
      `${URL}/rest/v1/mining_plan_purchases?user_id=eq.${user.id}&status=eq.active&select=id,plan_name,price_usdt`,
      { headers, cache: "no-store" }
    );

    if (!planRes.ok) {
      return NextResponse.json(
        { error: "Unable to verify active plan." },
        { status: 500 }
      );
    }

    const plans = await planRes.json();

    if (!plans?.length) {
      return NextResponse.json(
        { error: "You need an active plan." },
        { status: 403 }
      );
    }

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
          currency: "USDT",
          network: "BEP20",
          wallet_address: wallet,
          status: "Pending Review",
        }),
      }
    );

    const text = await saveRes.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {};
    }

    if (!saveRes.ok) {
      return NextResponse.json(
        { error: result.message || "Withdrawal request failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      withdrawal: result?.[0],
      message: "Withdrawal request submitted for manual review.",
    });

  } catch (error) {
    console.error("Withdrawal API error:", error);

    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}