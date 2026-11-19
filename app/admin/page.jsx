
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const dateFormat = (value) =>
  value ? new Date(value).toLocaleString() : "—";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080b0a",
    color: "#f5f5f5",
    padding: "18px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: "1500px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "25px",
  },
  brand: { color: "#d6ad45", fontSize: "24px", fontWeight: "bold" },
  button: {
    background: "#d6ad45",
    color: "#111",
    border: "none",
    padding: "11px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  card: {
    background: "#121816",
    border: "1px solid #29352e",
    borderRadius: "12px",
    padding: "18px",
    minWidth: 0,
  },
  label: { color: "#9ca89f", fontSize: "12px", marginBottom: "9px" },
  value: {
    color: "#d6ad45",
    fontSize: "23px",
    fontWeight: "bold",
    overflowWrap: "anywhere",
  },
  heading: { color: "#d6ad45", fontSize: "19px", marginBottom: "14px" },
  section: { marginTop: "28px" },
  tableWrap: {
    overflowX: "auto",
    background: "#121816",
    border: "1px solid #29352e",
    borderRadius: "10px",
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "750px" },
  cell: {
    padding: "12px",
    borderBottom: "1px solid #29352e",
    textAlign: "left",
    fontSize: "13px",
    verticalAlign: "middle",
  },
  input: {
    background: "#121816",
    color: "#fff",
    border: "1px solid #39483f",
    padding: "12px",
    borderRadius: "8px",
    width: "100%",
    outline: "none",
  },
};

function Status({ value }) {
  const status = String(value || "unknown").toLowerCase();
  let color = "#e8c45c";

  if (
    ["approved", "finished", "confirmed", "completed", "active", "posted", "paid"].includes(status)
  ) color = "#40d98b";

  if (
    ["rejected", "failed", "expired", "cancelled", "suspended"].includes(status)
  ) color = "#ff7777";

  return <span style={{ color, fontWeight: "bold" }}>{status.toUpperCase()}</span>;
}

function DataTable({ columns, rows, emptyText = "No records found." }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} style={{ ...styles.cell, color: "#d6ad45" }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ ...styles.cell, color: "#9ca89f" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => (
                  <td key={column.label} style={styles.cell}>
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  const [busyUser, setBusyUser] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const token = sessionData?.session?.access_token;
      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const raw = await response.text();
      let result;

      try {
        result = JSON.parse(raw);
      } catch {
        throw new Error(
          `Server haijarudisha JSON. HTTP ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Imeshindikana kupakia dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function changeUserStatus(user) {
    const action = user.is_banned ? "unban_user" : "ban_user";

    const confirmed = window.confirm(
      user.is_banned
        ? `Unaruhusu tena akaunti ya ${user.email}?`
        : `Unataka kusimamisha akaunti ya ${user.email}?`
    );

    if (!confirmed) return;

    setBusyUser(user.id);
    setError("");
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/admin/overview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, userId: user.id }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "User action failed.");

      setMessage(result.message || "User updated.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Imeshindikana kubadilisha user.");
    } finally {
      setBusyUser("");
    }
  }

  const users = data?.users || [];
  const deposits = data?.deposits || [];
  const withdrawals = data?.withdrawals || [];
  const wallets = data?.wallets || [];
  const transactions = data?.transactions || [];
  const planPurchases = data?.planPurchases || [];
  const planRules = data?.planRules || [];
  const profitPeriods = data?.profitPeriods || [];
  const profitAllocations = data?.profitAllocations || [];
  const stats = data?.stats || {};

  const emailByUser = useMemo(() => {
    const map = {};
    users.forEach((user) => {
      map[user.id] = user.email || user.id;
    });
    return map;
  }, [users]);

  const q = search.toLowerCase().trim();

  const filterRows = (rows, fields) => {
    if (!q) return rows;
    return rows.filter((row) =>
      fields
        .map((field) => String(row[field] ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  };

  const filteredUsers = users.filter((user) =>
    `${user.email} ${user.id} ${user.role}`.toLowerCase().includes(q)
  );

  const filteredWallets = wallets.filter((item) =>
    `${emailByUser[item.user_id] || ""} ${item.user_id} ${item.currency} ${item.network}`
      .toLowerCase().includes(q)
  );

  const filteredDeposits = deposits.filter((item) =>
    `${emailByUser[item.user_id] || ""} ${item.user_id} ${item.status} ${item.currency} ${item.provider_payment_id || ""}`
      .toLowerCase().includes(q)
  );

  const filteredWithdrawals = withdrawals.filter((item) =>
    `${emailByUser[item.user_id] || ""} ${item.user_id} ${item.status} ${item.currency} ${item.wallet_address}`
      .toLowerCase().includes(q)
  );

  const filteredTransactions = filterRows(transactions, [
    "user_id", "type", "status", "currency", "tx_hash", "provider_payment_id",
  ]);

  const filteredPurchases = filterRows(planPurchases, [
    "user_id", "plan_name", "status", "currency", "provider_payment_id",
  ]);

  const filteredPlans = filterRows(planRules, ["plan_name", "enabled"]);

  const filteredPeriods = filterRows(profitPeriods, [
    "period_name", "source", "status",
  ]);

  const filteredAllocations = filterRows(profitAllocations, [
    "user_id", "period_name", "plan_name", "source",
  ]);

  const tabs = [
    ["overview", "Overview"],
    ["users", "Users"],
    ["wallets", "Wallets"],
    ["deposits", "Deposits"],
    ["withdrawals", "Withdrawals"],
    ["transactions", "Transactions"],
    ["plans", "Investment Plans"],
    ["purchases", "Plan Purchases"],
    ["profits", "Profit Periods"],
    ["allocations", "Profit Allocations"],
  ];

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h2 style={styles.brand}>CRYPTO MINING HUB</h2>
          <p>Inafungua Admin Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.brand}>CRYPTO MINING HUB</div>
            <div style={{ color: "#9ca89f", marginTop: "6px" }}>
              Secure Administrator Dashboard
            </div>
          </div>

          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
            <button
              style={styles.button}
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await loadDashboard();
              }}
            >
              {refreshing ? "Loading..." : "Refresh"}
            </button>
            <button
              style={{ ...styles.button, background: "#26332b", color: "#fff" }}
              onClick={() => router.push("/")}
            >
              User Dashboard
            </button>
            <button
              style={{ ...styles.button, background: "#8b2929", color: "#fff" }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div style={{ ...styles.card, borderColor: "#a63d3d", marginBottom: "18px" }}>
            <strong style={{ color: "#ff9999" }}>Error</strong>
            <p style={{ overflowWrap: "anywhere" }}>{error}</p>
            <button style={styles.button} onClick={loadDashboard}>Try Again</button>
          </div>
        )}

        {message && (
          <div style={{ ...styles.card, borderColor: "#28794c", color: "#40d98b", marginBottom: "18px" }}>
            {message}
          </div>
        )}

        <nav style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "12px",
          marginBottom: "22px",
        }}>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setSearch("");
              }}
              style={{
                ...styles.button,
                whiteSpace: "nowrap",
                background: tab === key ? "#d6ad45" : "#1c2821",
                color: tab === key ? "#111" : "#ddd",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab !== "overview" && (
          <div style={{ marginBottom: "20px" }}>
            <input
              style={styles.input}
              placeholder="Search records..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        )}

        {tab === "overview" && (
          <>
            <h2 style={styles.heading}>Platform Overview</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
              gap: "14px",
            }}>
              {[
                ["TOTAL USERS", stats.totalUsers],
                ["APPROVED DEPOSITS", money(stats.totalDeposits)],
                ["PENDING DEPOSITS", stats.pendingDeposits],
                ["WITHDRAWAL REQUESTS", stats.totalWithdrawals],
                ["PENDING WITHDRAWALS", stats.pendingWithdrawals],
                ["TOTAL WALLET BALANCE", money(stats.totalWalletBalance)],
                ["ACTIVE PLAN PURCHASES", stats.activePlanPurchases],
                ["TOTAL PLAN SALES", money(stats.totalPlanSales)],
                ["ACTIVE PLANS", stats.enabledPlans],
                ["REALIZED PROFIT", money(stats.totalRealizedProfit)],
                ["ALLOCATED PROFIT", money(stats.totalAllocatedProfit)],
                ["PROFIT PERIODS", stats.totalProfitPeriods],
              ].map(([label, value]) => (
                <div style={styles.card} key={label}>
                  <div style={styles.label}>{label}</div>
                  <div style={styles.value}>{value ?? 0}</div>
                </div>
              ))}
            </div>

            <section style={styles.section}>
              <h2 style={styles.heading}>Recent Deposits</h2>
              <DataTable
                rows={deposits.slice(0, 5)}
                columns={[
                  {
                    label: "User",
                    render: (row) => emailByUser[row.user_id] || row.user_id,
                  },
                  {
                    label: "Amount",
                    render: (row) => money(row.actually_paid || row.price_amount || row.amount),
                  },
                  { label: "Currency", key: "currency" },
                  { label: "Status", render: (row) => <Status value={row.status} /> },
                  { label: "Date", render: (row) => dateFormat(row.created_at) },
                ]}
                emptyText="Hakuna deposit records."
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.heading}>Recent Withdrawals</h2>
              <DataTable
                rows={withdrawals.slice(0, 5)}
                columns={[
                  {
                    label: "User",
                    render: (row) => emailByUser[row.user_id] || row.user_id,
                  },
                  { label: "Amount", render: (row) => money(row.amount) },
                  { label: "Currency", key: "currency" },
                  { label: "Status", render: (row) => <Status value={row.status} /> },
                  { label: "Date", render: (row) => dateFormat(row.created_at) },
                ]}
                emptyText="Hakuna withdrawal requests."
              />
            </section>
          </>
        )}

        {tab === "users" && (
          <section>
            <h2 style={styles.heading}>User Management</h2>
            <DataTable
              rows={filteredUsers}
              emptyText="Hakuna users waliopatikana."
              columns={[
                { label: "Email", key: "email" },
                { label: "User ID", key: "id" },
                { label: "Role", key: "role" },
                {
                  label: "Account",
                  render: (row) => <Status value={row.is_banned ? "suspended" : "active"} />,
                },
                { label: "Registered", render: (row) => dateFormat(row.created_at) },
                {
                  label: "Action",
                  render: (row) =>
                    row.role === "admin" ? (
                      <span style={{ color: "#d6ad45" }}>Protected Admin</span>
                    ) : (
                      <button
                        style={{
                          ...styles.button,
                          padding: "8px 10px",
                          background: row.is_banned ? "#28794c" : "#8b2929",
                          color: "#fff",
                        }}
                        disabled={busyUser === row.id}
                        onClick={() => changeUserStatus(row)}
                      >
                        {busyUser === row.id
                          ? "Please wait..."
                          : row.is_banned ? "Reactivate" : "Suspend"}
                      </button>
                    ),
                },
              ]}
            />
          </section>
        )}

        {tab === "wallets" && (
          <section>
            <h2 style={styles.heading}>Wallet Management</h2>
            <DataTable
              rows={filteredWallets}
              columns={[
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                { label: "User ID", key: "user_id" },
                { label: "Balance", render: (row) => money(row.balance) },
                { label: "Currency", key: "currency" },
                { label: "Network", key: "network" },
              ]}
              emptyText="Hakuna wallet records."
            />
          </section>
        )}

        {tab === "deposits" && (
          <section>
            <h2 style={styles.heading}>Deposit Management</h2>
            <DataTable
              rows={filteredDeposits}
              columns={[
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                {
                  label: "Amount",
                  render: (row) => money(row.actually_paid || row.price_amount || row.amount),
                },
                { label: "Currency", key: "currency" },
                { label: "Network", key: "network" },
                { label: "Status", render: (row) => <Status value={row.status} /> },
                { label: "Payment ID", key: "provider_payment_id" },
                { label: "Date", render: (row) => dateFormat(row.created_at) },
              ]}
              emptyText="Hakuna deposit records."
            />
            <p style={{ color: "#9ca89f", fontSize: "12px", marginTop: "12px" }}>
              Deposit crediting is controlled by verified NOWPayments notifications.
            </p>
          </section>
        )}

        {tab === "withdrawals" && (
          <section>
            <h2 style={styles.heading}>Withdrawal Management</h2>
            <DataTable
              rows={filteredWithdrawals}
              columns={[
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                { label: "User ID", key: "user_id" },
                { label: "Amount", render: (row) => money(row.amount) },
                { label: "Currency", key: "currency" },
                { label: "Network", key: "network" },
                { label: "Wallet Address", key: "wallet_address" },
                { label: "Status", render: (row) => <Status value={row.status} /> },
                { label: "Date", render: (row) => dateFormat(row.created_at) },
              ]}
              emptyText="Hakuna withdrawal requests."
            />
            <p style={{ color: "#9ca89f", fontSize: "12px", marginTop: "12px" }}>
              Hapa unaona maombi ya withdrawal. Approval na kutuma malipo bado vinahitaji payout workflow salama.
            </p>
          </section>
        )}

        {tab === "transactions" && (
          <section>
            <h2 style={styles.heading}>All Transactions</h2>
            <DataTable
              rows={filteredTransactions}
              columns={[
                { label: "Type", key: "type" },
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                {
                  label: "Amount",
                  render: (row) => money(row.actually_paid || row.price_amount || row.amount),
                },
                { label: "Currency", key: "currency" },
                { label: "Network", key: "network" },
                { label: "Status", render: (row) => <Status value={row.status} /> },
                { label: "Transaction Hash", key: "tx_hash" },
                { label: "Date", render: (row) => dateFormat(row.created_at) },
              ]}
              emptyText="Hakuna transactions."
            />
          </section>
        )}

        {tab === "plans" && (
          <section>
            <h2 style={styles.heading}>Investment Plan Rules</h2>
            <DataTable
              rows={filteredPlans}
              columns={[
                { label: "Plan", key: "plan_name" },
                { label: "Price", render: (row) => money(row.price_usdt) },
                { label: "Profit Weight", key: "profit_weight" },
                {
                  label: "Status",
                  render: (row) => <Status value={row.enabled ? "active" : "disabled"} />,
                },
                { label: "Updated", render: (row) => dateFormat(row.updated_at) },
              ]}
              emptyText="Hakuna investment plan rules."
            />
            <p style={{ color: "#9ca89f", fontSize: "12px", marginTop: "12px" }}>
              Kwa sasa sehemu hii inaonyesha plan rules zilizopo kwenye database. Haibadilishi bei au profit weight.
            </p>
          </section>
        )}

        {tab === "purchases" && (
          <section>
            <h2 style={styles.heading}>Mining Plan Purchases</h2>
            <DataTable
              rows={filteredPurchases}
              columns={[
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                { label: "Plan", key: "plan_name" },
                { label: "Price", render: (row) => money(row.price_usdt) },
                { label: "Currency", key: "currency" },
                { label: "Network", key: "network" },
                { label: "Status", render: (row) => <Status value={row.status} /> },
                { label: "Payment ID", key: "provider_payment_id" },
                { label: "Purchase Date", render: (row) => dateFormat(row.created_at) },
                { label: "Activated", render: (row) => dateFormat(row.activated_at) },
              ]}
              emptyText="Hakuna plan purchases."
            />
          </section>
        )}

        {tab === "profits" && (
          <section>
            <h2 style={styles.heading}>Investment Profit Periods</h2>
            <DataTable
              rows={filteredPeriods}
              columns={[
                { label: "Period", key: "period_name" },
                { label: "Source", key: "source" },
                { label: "Start", key: "start_date" },
                { label: "End", key: "end_date" },
                {
                  label: "Realized Profit",
                  render: (row) => money(row.realized_profit_usdt),
                },
                { label: "Status", render: (row) => <Status value={row.status} /> },
                { label: "Created", render: (row) => dateFormat(row.created_at) },
                { label: "Posted", render: (row) => dateFormat(row.posted_at) },
              ]}
              emptyText="Hakuna profit periods."
            />
            <p style={{ color: "#9ca89f", fontSize: "12px", marginTop: "12px" }}>
              Profit periods zinaonekana hapa. Kuanzisha, kuidhinisha au kugawa profit bado hakujawashwa kupitia dashboard hii.
            </p>
          </section>
        )}

        {tab === "allocations" && (
          <section>
            <h2 style={styles.heading}>Profit Allocations</h2>
            <DataTable
              rows={filteredAllocations}
              columns={[
                {
                  label: "User",
                  render: (row) => emailByUser[row.user_id] || row.user_id,
                },
                { label: "Period", key: "period_name" },
                { label: "Plan", key: "plan_name" },
                { label: "Source", key: "source" },
                { label: "Principal", render: (row) => money(row.principal_usdt) },
                { label: "Plan Weight", key: "plan_weight" },
                { label: "Allocation Weight", key: "allocation_weight" },
                { label: "Profit", render: (row) => money(row.profit_usdt) },
                { label: "Created", render: (row) => dateFormat(row.created_at) },
              ]}
              emptyText="Hakuna profit allocations."
            />
          </section>
        )}

        <footer style={{
          marginTop: "40px",
          borderTop: "1px solid #29352e",
          paddingTop: "18px",
          color: "#718078",
          fontSize: "12px",
          textAlign: "center",
        }}>
          Crypto Mining Hub · Secure Admin Area
        </footer>
      </div>
    </main>
  );
}
