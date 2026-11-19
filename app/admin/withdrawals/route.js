
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon || !service) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "Please login as admin." },
        { status: 401 }
      );
    }

    const authClient = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "Invalid session. Login again." },
        { status: 401 }
      );
    }

    if (authData.user.app_metadata?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const withdrawalId = String(body.withdrawalId || "").trim();
    const decision = String(body.decision || "").trim().toLowerCase();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(withdrawalId)
    ) {
      return NextResponse.json(
        { error: "Invalid withdrawal ID." },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be approve or reject." },
        { status: 400 }
      );
    }

    const adminClient = createClient(url, service, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await adminClient.rpc(
      "review_secure_withdrawal",
      {
        p_withdrawal_id: withdrawalId,
        p_decision: decision,
      }
    );

    if (error) {
      console.error("Withdrawal review error:", error);

      return NextResponse.json(
        { error: error.message || "Withdrawal review failed." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
      message:
        decision === "reject"
          ? "Withdrawal rejected. Funds returned to user wallet."
          : "Withdrawal approved and awaiting payout.",
    });
  } catch (error) {
    console.error("Admin withdrawal API error:", error);

    return NextResponse.json(
      { error: "Server error reviewing withdrawal." },
      { status: 500 }
    );
  }
}
