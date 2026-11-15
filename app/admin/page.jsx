
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const dateFormat = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080b0a",
    color: "#f5f5f5",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "1250px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "15px",
    marginBottom: "28px",
  },
  brand: {
    color: "#d6ad45",
    fontSize: "23px",
    fontWeight: "bold",
  },
  button: {
    background: "#d6ad45",
    color: "#111",
    border: "none",
    padding: "11px 17px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  card: {
    background: "#121816",
    border: "1px solid #29352e",
    borderRadius: "12px",
    padding: "19px",
    minWidth: 0,
  },
  label: {
    color: "#9ca89f",
    fontSize: "13px",
    marginBottom: "10px",
  },
  value: {
    color: "#d6ad45",
    fontSize: "25px",
    fontWeight: "bold",
    overflowWrap: "anywhere",
  },
  section: {
    marginTop: "28px",
  },
  heading: {
    color: "#d6ad45",
    fontSize: "19px",
    marginBottom: "14px",
  },
  tableWrap: {
    overflowX: "auto",
    background: "#121816",
    border: "1px solid #29352e",
    borderRadius: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "650px",
  },
  cell: {
    padding: "13px",
    borderBottom: "1px solid #29352e",
    textAlign: "left",
    fontSize: "13px",
  },
};

function DataTable({ columns, rows, emptyText }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                style={{ ...styles.cell, color: "#d6ad45" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...styles.cell, color: "#9ca89f" }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => (
                  <td key={column.label} style={styles.cell}>
                    {column.render
                      ? column.render(row)
                      : row[column.key] || "—"}
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
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError("");

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const token = sessionData?.session?.access_token;

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/admin/overview", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        const preview = responseText
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180);

        throw new Error(
          `Server haikurudisha JSON. HTTP ${response.status}. ${
            preview || "Angalia Vercel Build Logs."
          }`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.error || `Server error: HTTP ${response.status}`
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err.message || "Imeshindikana kufungua Admin Dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h2 style={{ color: "#d6ad45" }}>
            CRYPTO MINING HUB
          </h2>
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
            <div style={styles.brand}>
              CRYPTO MINING HUB
            </div>
            <div style={{ color: "#9ca89f", marginTop: "6px" }}>
              Administrator Dashboard
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              style={styles.button}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Loading..." : "Refresh"}
            </button>

            <button
              style={{
                ...styles.button,
                background: "#26332b",
                color: "#fff",
              }}
              onClick={() => router.push("/")}
            >
              User Dashboard
            </button>

            <button
              style={{
                ...styles.button,
                background: "#8b2929",
                color: "#fff",
              }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <div
            style={{
              ...styles.card,
              borderColor: "#a63d3d",
              color: "#ffaaaa",
              marginBottom: "22px",
            }}
          >
            <strong>Dashboard Error</strong>
            <p style={{ overflowWrap: "anywhere" }}>
              {error}
            </p>
            <button
              style={styles.button}
              onClick={handleRefresh}
            >
              Try Again
            </button>
          </div>
        ) : null}

        {data ? (
          <>
            <h2 style={styles.heading}>
              Platform Overview
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "15px",
              }}
            >
              <div style={styles.card}>
                <div style={styles.label}>TOTAL USERS</div>
                <div style={styles.value}>
                  {data.stats?.totalUsers ?? 0}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.label}>
                  APPROVED DEPOSITS
                </div>
                <div style={styles.value}>
                  {money(data.stats?.totalDeposits)}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.label}>
                  APPROVED DEPOSIT COUNT
                </div>
                <div style={styles.value}>
                  {data.stats?.approvedDeposits ?? 0}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.label}>
                  PENDING DEPOSITS
                </div>
                <div style={styles.value}>
                  {data.stats?.pendingDeposits ?? 0}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.label}>
                  WITHDRAWAL REQUESTS
                </div>
                <div style={styles.value}>
                  {data.stats?.totalWithdrawals ?? 0}
                </div>
              </div>
            </div>

            <section style={styles.section}>
              <h2 style={styles.heading}>
                Registered Users
              </h2>

              <DataTable
                emptyText="Hakuna users waliopatikana."
                rows={data.users || []}
                columns={[
                  { label: "Email", key: "email" },
                  { label: "Role", key: "role" },
                  {
                    label: "Registered",
                    render: (row) =>
                      dateFormat(row.created_at),
                  },
                ]}
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.heading}>
                Deposit History
              </h2>

              <DataTable
                emptyText="Hakuna deposit records."
                rows={data.deposits || []}
                columns={[
                  { label: "User ID", key: "user_id" },
                  {
                    label: "Amount",
                    render: (row) =>
                      money(
                        row.actually_paid ||
                          row.price_amount ||
                          row.amount
                      ),
                  },
                  { label: "Currency", key: "currency" },
                  {
                    label: "Status",
                    render: (row) => (
                      <span
                        style={{
                          color:
                            row.status === "approved"
                              ? "#40d98b"
                              : row.status === "pending"
                              ? "#e8c45c"
                              : "#ff9999",
                          fontWeight: "bold",
                        }}
                      >
                        {row.status}
                      </span>
                    ),
                  },
                  {
                    label: "Date",
                    render: (row) =>
                      dateFormat(row.created_at),
                  },
                ]}
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.heading}>
                Withdrawal History
              </h2>

              <DataTable
                emptyText="Hakuna withdrawal records."
                rows={data.withdrawals || []}
                columns={[
                  { label: "User ID", key: "user_id" },
                  {
                    label: "Amount",
                    render: (row) => money(row.amount),
                  },
                  { label: "Currency", key: "currency" },
                  { label: "Status", key: "status" },
                  {
                    label: "Date",
                    render: (row) =>
                      dateFormat(row.created_at),
                  },
                ]}
              />
            </section>
          </>
        ) : null}

        <footer
          style={{
            marginTop: "35px",
            borderTop: "1px solid #29352e",
            paddingTop: "18px",
            color: "#718078",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Crypto Mining Hub · Secure Admin Area
        </footer>
      </div>
    </main>
  );
}
