
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

async function getAdmin(request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: jsonError("Unauthorized. Please login.", 401) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return {
      error: jsonError("Server configuration is incomplete.", 500),
    };
  }

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return { error: jsonError("Invalid session. Login again.", 401) };
  }

  if (data.user.app_metadata?.role !== "admin") {
    return { error: jsonError("Admin access required.", 403) };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { adminClient, adminUser: data.user };
}

export async function GET(request) {
  try {
    const auth = await getAdmin(request);
    if (auth.error) return auth.error;

    const db = auth.adminClient;

    const [
      usersResult,
      depositsResult,
      transactionsResult,
      withdrawalsResult,
      walletsResult,
      purchasesResult,
      planRulesResult,
      profitPeriodsResult,
      profitAllocationsResult,
    ] = await Promise.all([
      db.auth.admin.listUsers({ page: 1, perPage: 100 }),

      db
        .from("transactions")
        .select("*")
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(500),

      db
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      db
        .from("mining_withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      db
        .from("wallets")
        .select("id, user_id, currency, network, balance, created_at")
        .order("balance", { ascending: false })
        .limit(500),

      db
        .from("mining_plan_purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      db
        .from("investment_plan_rules")
        .select("*")
        .order("price_usdt", { ascending: true }),

      db
        .from("investment_profit_periods")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      db
        .from("investment_profit_allocations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const results = [
      ["Users", usersResult],
      ["Deposits", depositsResult],
      ["Transactions", transactionsResult],
      ["Withdrawals", withdrawalsResult],
      ["Wallets", walletsResult],
      ["Plan purchases", purchasesResult],
      ["Plan rules", planRulesResult],
      ["Profit periods", profitPeriodsResult],
      ["Profit allocations", profitAllocationsResult],
    ];

    for (const [name, result] of results) {
      if (result.error) {
        console.error(`${name} query error:`, result.error);
        throw new Error(`${name}: ${result.error.message}`);
      }
    }

    const users = usersResult.data.users || [];
    const deposits = depositsResult.data || [];
    const transactions = transactionsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];
    const wallets = walletsResult.data || [];
    const planPurchases = purchasesResult.data || [];
    const planRules = planRulesResult.data || [];
    const profitPeriods = profitPeriodsResult.data || [];
    const profitAllocations = profitAllocationsResult.data || [];

    const isApproved = (status) =>
      ["approved", "finished", "confirmed", "completed", "paid"].includes(
        String(status || "").toLowerCase()
      );

    const isPending = (status) =>
      ["pending", "waiting", "pending review", "processing"].includes(
        String(status || "").toLowerCase()
      );

    const approvedDeposits = deposits.filter((item) =>
      isApproved(item.status)
    );

    const pendingDeposits = deposits.filter((item) =>
      isPending(item.status)
    );

    const pendingWithdrawals = withdrawals.filter((item) =>
      isPending(item.status)
    );

    const activePurchases = planPurchases.filter((item) =>
      ["active", "approved", "finished", "confirmed", "completed"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const postedProfitPeriods = profitPeriods.filter((item) =>
      ["posted", "completed", "closed"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const totalDeposits = approvedDeposits.reduce(
      (sum, item) =>
        sum +
        Number(
          item.actually_paid ||
            item.price_amount ||
            item.amount ||
            0
        ),
      0
    );

    const totalWithdrawals = withdrawals
      .filter((item) => isApproved(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalWalletBalance = wallets.reduce(
      (sum, item) => sum + Number(item.balance || 0),
      0
    );

    const totalPlanSales = activePurchases.reduce(
      (sum, item) => sum + Number(item.price_usdt || 0),
      0
    );

    const totalRealizedProfit = postedProfitPeriods.reduce(
      (sum, item) =>
        sum + Number(item.realized_profit_usdt || 0),
      0
    );

    const totalAllocatedProfit = profitAllocations.reduce(
      (sum, item) => sum + Number(item.profit_usdt || 0),
      0
    );

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: user.app_metadata?.role || "user",
        banned_until: user.banned_until || null,
        is_banned:
          !!user.banned_until &&
          new Date(user.banned_until).getTime() > Date.now(),
      })),

      wallets,
      deposits,
      transactions,
      withdrawals,
      planPurchases,
      planRules,
      profitPeriods,
      profitAllocations,

      stats: {
        totalUsers: users.length,

        totalDeposits,
        approvedDeposits: approvedDeposits.length,
        pendingDeposits: pendingDeposits.length,

        totalWithdrawals: withdrawals.length,
        approvedWithdrawals: withdrawals.filter((item) =>
          isApproved(item.status)
        ).length,
        pendingWithdrawals: pendingWithdrawals.length,
        totalWithdrawalAmount: totalWithdrawals,

        totalWallets: wallets.length,
        totalWalletBalance,

        totalPlanPurchases: planPurchases.length,
        activePlanPurchases: activePurchases.length,
        totalPlanSales,

        totalPlans: planRules.length,
        enabledPlans: planRules.filter((item) => item.enabled === true).length,

        totalProfitPeriods: profitPeriods.length,
        postedProfitPeriods: postedProfitPeriods.length,
        totalRealizedProfit,
        totalAllocatedProfit,
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);

    return jsonError(
      error?.message || "Could not load admin dashboard.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const auth = await getAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { action, userId } = body || {};

    if (!userId || typeof userId !== "string") {
      return jsonError("Valid user ID is required.", 400);
    }

    if (!["ban_user", "unban_user"].includes(action)) {
      return jsonError("Unsupported admin action.", 400);
    }

    if (userId === auth.adminUser.id) {
      return jsonError("You cannot suspend your own admin account.", 400);
    }

    const db = auth.adminClient;

    const { data: targetResult, error: targetError } =
      await db.auth.admin.getUserById(userId);

    if (targetError || !targetResult?.user) {
      return jsonError("User account was not found.", 404);
    }

    if (targetResult.user.app_metadata?.role === "admin") {
      return jsonError("Admin accounts cannot be suspended here.", 403);
    }

    const banDuration =
      action === "ban_user" ? "876000h" : "none";

    const { data, error } = await db.auth.admin.updateUserById(
      userId,
      { ban_duration: banDuration }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message:
        action === "ban_user"
          ? "User account suspended successfully."
          : "User account reactivated successfully.",
      user: {
        id: data.user.id,
        email: data.user.email,
        banned_until: data.user.banned_until || null,
      },
    });
  } catch (error) {
    console.error("Admin action error:", error);

    return jsonError(
      error?.message || "Admin action failed.",
      500
    );
  }
}
