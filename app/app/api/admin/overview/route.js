
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "Invalid session. Please login again." },
        { status: 401 }
      );
    }

    if (authData.user.app_metadata?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const [
      usersResult,
      depositsResult,
      withdrawalsResult,
    ] = await Promise.all([
      adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      }),

      adminClient
        .from("transactions")
        .select(
          "id, user_id, amount, currency, status, created_at, provider_payment_id, actually_paid, price_amount"
        )
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(100),

      adminClient
        .from("transactions")
        .select(
          "id, user_id, amount, currency, status, created_at"
        )
        .eq("type", "withdraw")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (depositsResult.error) throw depositsResult.error;
    if (withdrawalsResult.error) throw withdrawalsResult.error;

    const users = usersResult.data.users || [];
    const deposits = depositsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];

    const approvedDeposits = deposits.filter(
      (item) => item.status === "approved"
    );

    const totalDeposits = approvedDeposits.reduce(
      (sum, item) =>
        sum + Number(item.actually_paid || 0),
      0
    );

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: user.app_metadata?.role || "user",
      })),

      deposits,
      withdrawals,

      stats: {
        totalUsers: users.length,
        totalDeposits,
        approvedDeposits: approvedDeposits.length,
        pendingDeposits: deposits.filter(
          (item) =>
            item.status === "pending" ||
            item.status === "waiting"
        ).length,
        totalWithdrawals: withdrawals.length,
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);

    return NextResponse.json(
      { error: "Could not load admin dashboard." },
      { status: 500 }
    );
  }
}
