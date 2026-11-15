
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [section, setSection] = useState("overview");

  async function loadAdminData() {
    setLoading(true);
    setError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Please log in first.");
      }

      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Admin access denied.");
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Could not load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const money = (amount) =>
    Number(amount || 0).toFixed(4) + " USDT";

  const date = (value) =>
    value ? new Date(value).toLocaleString() : "—";

  const buttonStyle = (active) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "13px",
    marginBottom: "8px",
    borderRadius: "8px",
    border: "1px solid #393322",
    background: active ? "#302718" : "#151a15",
    color: active ? "#f0c45b" : "#c6c9bf",
    cursor: "pointer"
  });

  const cardStyle = {
    background: "#151a15",
    border: "1px solid #34382d",
    borderRadius: "12px",
    padding: "20px",
    minWidth: 0
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px"
  };

  const cellStyle = {
    padding: "12px 9px",
    borderBottom: "1px solid #30372e",
    textAlign: "left",
    overflowWrap: "anywhere"
  };

  if (loading) {
    return (
      <main style={pageStyle}>
        <h2 style={{ color: "#f0c45b" }}>Loading Admin Dashboard...</h2>
      </main>
    );
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <h1 style={{ color: "#f0c45b" }}>Crypto Mining Hub</h1>
        <div style={cardStyle}>
          <h2>Admin Access</h2>
          <p style={{ color: "#ff8585" }}>{error}</p>
          <button style={goldButton} onClick={loadAdminData}>
            TRY AGAIN
          </button>
          <button style={darkButton} onClick={() => window.location.href = "/"}>
            BACK TO HOME
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h2 style={{ color: "#f0c45b", margin: 0 }}>
            CRYPTO MINING HUB
          </h2>
          <small style={{ color: "#899087" }}>ADMIN CONTROL CENTER</small>
        </div>

        <button style={darkButton} onClick={logout}>LOGOUT</button>
      </header>

      <div style={layoutStyle}>
        <aside style={sidebarStyle}>
          <h4 style={{ color: "#899087" }}>ADMIN MENU</h4>

          <button style={buttonStyle(section === "overview")}
            onClick={() => setSection("overview")}>
            ▦ Overview
          </button>

          <button style={buttonStyle(section === "users")}
            onClick={() => setSection("users")}>
            👥 Users Management
          </button>

          <button style={buttonStyle(section === "deposits")}
            onClick={() => setSection("deposits")}>
            📥 Deposits
          </button>

          <button style={buttonStyle(section === "withdrawals")}
            onClick={() => setSection("withdrawals")}>
            📤 Withdrawals
          </button>

          <button style={buttonStyle(false)}
            onClick={() => window.location.href = "/"}>
            ← User Dashboard
          </button>
        </aside>

        <section style={{ minWidth: 0 }}>
          <div style={sectionHeader}>
            <div>
              <h1 style={{ margin: "0 0 7px" }}>
                {section === "overview" && "Admin Overview"}
                {section === "users" && "Users Management"}
                {section === "deposits" && "Deposit Management"}
                {section === "withdrawals" && "Withdrawal Management"}
              </h1>
              <p style={{ color: "#899087", fontSize: "13px" }}>
                Manage and monitor Crypto Mining Hub.
              </p>
            </div>

            <button style={goldButton} onClick={loadAdminData}>
              ↻ REFRESH
            </button>
          </div>

          {section === "overview" && (
            <>
              <div style={statsStyle}>
                <div style={cardStyle}>
                  <small>Total Users</small>
                  <h2 style={goldText}>{data.stats.totalUsers}</h2>
                </div>

                <div style={cardStyle}>
                  <small>Approved Deposits</small>
                  <h2 style={goldText}>{money(data.stats.totalDeposits)}</h2>
                </div>

                <div style={cardStyle}>
                  <small>Pending Deposits</small>
                  <h2 style={goldText}>{data.stats.pendingDeposits}</h2>
                </div>

                <div style={cardStyle}>
                  <small>Withdrawal Records</small>
                  <h2 style={goldText}>{data.stats.totalWithdrawals}</h2>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={goldText}>Latest Deposits</h3>
                <DepositTable deposits={data.deposits.slice(0, 5)} />
              </div>
            </>
          )}

          {section === "users" && (
            <div style={cardStyle}>
              <h3 style={goldText}>Registered Users</h3>
              <p style={{ color: "#899087", fontSize: "12px" }}>
                Showing the first 100 user accounts.
              </p>

              <div style={scrollStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={cellStyle}>Email</th>
                      <th style={cellStyle}>Role</th>
                      <th style={cellStyle}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <td style={cellStyle}>{user.email || "—"}</td>
                        <td style={cellStyle}>{user.role}</td>
                        <td style={cellStyle}>{date(user.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === "deposits" && (
            <div style={cardStyle}>
              <h3 style={goldText}>All Deposit Records</h3>
              <DepositTable deposits={data.deposits} />
            </div>
          )}

          {section === "withdrawals" && (
            <div style={cardStyle}>
              <h3 style={goldText}>Withdrawal Records</h3>

              {data.withdrawals.length === 0 ? (
                <p style={{ color: "#899087" }}>
                  No withdrawal records found.
                </p>
              ) : (
                <div style={scrollStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={cellStyle}>User ID</th>
                        <th style={cellStyle}>Amount</th>
                        <th style={cellStyle}>Status</th>
                        <th style={cellStyle}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.withdrawals.map((item) => (
                        <tr key={item.id}>
                          <td style={cellStyle}>{item.user_id}</td>
                          <td style={cellStyle}>{money(item.amount)}</td>
                          <td style={cellStyle}>{item.status}</td>
                          <td style={cellStyle}>{date(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );

  function DepositTable({ deposits }) {
    if (!deposits.length) {
      return <p style={{ color: "#899087" }}>No deposit records found.</p>;
    }

    return (
      <div style={scrollStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>User ID</th>
              <th style={cellStyle}>USD Amount</th>
              <th style={cellStyle}>Received</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Payment ID</th>
              <th style={cellStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((item) => (
              <tr key={item.id}>
                <td style={cellStyle}>{item.user_id}</td>
                <td style={cellStyle}>${Number(item.price_amount ?? item.amount ?? 0).toFixed(2)}</td>
                <td style={cellStyle}>{item.actually_paid ? money(item.actually_paid) : "Awaiting"}</td>
                <td style={cellStyle}>{item.status}</td>
                <td style={cellStyle}>{item.provider_payment_id || "—"}</td>
                <td style={cellStyle}>{date(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

const pageStyle = {
  minHeight: "100vh",
  background: "#080b0a",
  color: "#f4f4ef",
  padding: "20px",
  fontFamily: "Arial, sans-serif"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  padding: "15px 0",
  borderBottom: "1px solid #292d25"
};

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "220px minmax(0, 1fr)",
  gap: "22px",
  maxWidth: "1500px",
  margin: "25px auto"
};

const sidebarStyle = {
  background: "#111611",
  border: "1px solid #292d25",
  borderRadius: "12px",
  padding: "15px",
  alignSelf: "start"
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "12px",
  marginBottom: "22px"
};

const statsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px"
};

const goldText = { color: "#f0c45b" };

const goldButton = {
  padding: "11px 16px",
  border: 0,
  borderRadius: "8px",
  background: "linear-gradient(135deg,#f3d47f,#c39636)",
  color: "#11130d",
  fontWeight: "bold",
  cursor: "pointer"
};

const darkButton = {
  padding: "11px 15px",
  border: "1px solid #4b4230",
  borderRadius: "8px",
  background: "#171711",
  color: "#f0c45b",
  cursor: "pointer"
};

const scrollStyle = {
  width: "100%",
  overflowX: "auto"
};
