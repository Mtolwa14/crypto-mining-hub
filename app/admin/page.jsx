
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const menu = [
  { name: "Overview", icon: "▦" },
  { name: "Users", icon: "♙" },
  { name: "Deposits", icon: "↓" },
  { name: "Withdrawals", icon: "↑" },
  { name: "Mining Plans", icon: "⛏" },
  { name: "Investments", icon: "◆" },
  { name: "Settings", icon: "⚙" },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [section, setSection] = useState("Overview");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    users: 0,
    transactions: 0,
    investments: 0,
    withdrawals: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData?.user) {
        window.location.replace("/");
        return;
      }

      const user = authData.user;

      const { data: adminRecord, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id,email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminRecord) {
        window.location.replace("/");
        return;
      }

      setAuthorized(true);
      setAdminEmail(adminRecord.email || user.email || "");

      await loadStats();
      await loadUsers();
    } catch (err) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const [u, t, i, w] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("transactions").select("*", { count: "exact", head: true }),
      supabase.from("mining_plan_purchases").select("*", { count: "exact", head: true }),
      supabase.from("mining_withdrawals").select("*", { count: "exact", head: true }),
    ]);

    setStats({
      users: u.count || 0,
      transactions: t.count || 0,
      investments: i.count || 0,
      withdrawals: w.count || 0,
    });

    const errors = [u.error, t.error, i.error, w.error].filter(Boolean);

    if (errors.length) {
      setError(errors.map((e) => e.message).join(" | "));
    }
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,email,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setError(error.message);
      return;
    }

    setUsers(data || []);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();

    return (
      (user.email || "").toLowerCase().includes(q) ||
      (user.user_id || "").toLowerCase().includes(q)
    );
  });

  const cards = [
    { label: "TOTAL USERS", value: stats.users, icon: "♙", color: "#e6bd65" },
    { label: "TRANSACTIONS", value: stats.transactions, icon: "⇄", color: "#64d6ae" },
    { label: "MINING INVESTMENTS", value: stats.investments, icon: "◆", color: "#b79cff" },
    { label: "WITHDRAWAL REQUESTS", value: stats.withdrawals, icon: "↑", color: "#ff9b72" },
  ];

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingLogo}>₿</div>
        <p>VERIFYING ADMIN ACCESS...</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.logo}>₿</div>
          <div>
            <div style={styles.brandName}>CRYPTO MINING</div>
            <div style={styles.brandSub}>HUB ADMIN</div>
          </div>
        </div>

        <div style={styles.menuLabel}>ADMIN PANEL</div>

        {menu.map((item) => (
          <button
            key={item.name}
            onClick={() => setSection(item.name)}
            style={{
              ...styles.menuItem,
              ...(section === item.name ? styles.activeMenu : {}),
            }}
          >
            <span style={styles.menuIcon}>{item.icon}</span>
            {item.name}
          </button>
        ))}

        <div style={styles.sidebarBottom}>
          <div style={styles.adminBadge}>
            <div style={styles.adminAvatar}>A</div>
            <div style={{ overflow: "hidden" }}>
              <div style={styles.adminText}>Administrator</div>
              <div style={styles.adminEmail}>{adminEmail}</div>
            </div>
          </div>

          <button onClick={logout} style={styles.logout}>
            ↪ Logout
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              ADMIN / {section.toUpperCase()}
            </div>
            <h1 style={styles.heading}>{section}</h1>
            <p style={styles.subtitle}>
              Manage Crypto Mining Hub platform.
            </p>
          </div>

          <div style={styles.status}>
            <span style={styles.statusDot}></span>
            ADMIN ACCESS VERIFIED
          </div>
        </header>

        {error && <div style={styles.error}>⚠ {error}</div>}

        {section === "Overview" && (
          <>
            <div style={styles.sectionTitle}>PLATFORM OVERVIEW</div>

            <div style={styles.cards}>
              {cards.map((card) => (
                <div key={card.label} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardLabel}>{card.label}</div>
                    <div style={{ ...styles.cardIcon, color: card.color }}>
                      {card.icon}
                    </div>
                  </div>
                  <div style={styles.cardValue}>
                    {card.value.toLocaleString()}
                  </div>
                  <div style={styles.cardFooter}>Database count</div>
                </div>
              ))}
            </div>

            <div style={styles.contentGrid}>
              <div style={styles.panel}>
                <h2 style={styles.panelTitle}>Platform Status</h2>

                {[
                  ["Authentication", "Connected"],
                  ["Admin Security", "Verified"],
                  ["Database", "Connected"],
                  ["Platform", "Crypto Mining Hub"],
                ].map(([label, value]) => (
                  <div key={label} style={styles.statusRow}>
                    <span style={styles.statusRowLabel}>{label}</span>
                    <span style={styles.statusRowValue}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={styles.panel}>
                <h2 style={styles.panelTitle}>Admin Information</h2>
                <p style={styles.infoEmail}>{adminEmail}</p>
                <div style={styles.securityNote}>
                  ADMIN ACCESS IS RESTRICTED TO AUTHORIZED ACCOUNTS.
                </div>
              </div>
            </div>
          </>
        )}

        {section === "Users" && (
          <div style={styles.panel}>
            <div style={styles.usersHeader}>
              <div>
                <h2 style={styles.panelTitle}>Registered Users</h2>
                <p style={styles.infoEmail}>
                  Total registered users: {users.length}
                </p>
              </div>

              <button
                style={styles.refreshButton}
                onClick={loadUsers}
              >
                ↻ Refresh
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or user ID..."
              style={styles.search}
            />

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>EMAIL</th>
                    <th style={styles.th}>USER ID</th>
                    <th style={styles.th}>REGISTERED</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td style={styles.td}>
                        {user.email || "No email"}
                      </td>
                      <td style={styles.tdUserId}>{user.user_id}</td>
                      <td style={styles.td}>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} style={styles.empty}>
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section !== "Overview" && section !== "Users" && (
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>{section}</h2>
            <p style={styles.infoEmail}>
              This management section will be connected in the next development step.
            </p>
          </div>
        )}

        <div style={styles.footer}>
          CRYPTO MINING HUB ADMIN PANEL
          <span>SECURE MANAGEMENT</span>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#090b0f",
    color: "#f4f4f4",
    display: "flex",
    fontFamily: "Arial, sans-serif",
  },

  loading: {
    minHeight: "100vh",
    background: "#090b0f",
    color: "#e4bd68",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  loadingLogo: {
    fontSize: 48,
    fontWeight: 900,
  },

  sidebar: {
    width: 245,
    minHeight: "100vh",
    background: "#0d1015",
    borderRight: "1px solid #242820",
    padding: "28px 18px",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 8px 32px",
  },

  logo: {
    width: 43,
    height: 43,
    borderRadius: 13,
    background: "linear-gradient(135deg,#f0d38a,#a47b2b)",
    color: "#111",
    display: "grid",
    placeItems: "center",
    fontSize: 25,
    fontWeight: 900,
  },

  brandName: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.3,
  },

  brandSub: {
    fontSize: 10,
    color: "#d4ad55",
    letterSpacing: 2,
    marginTop: 5,
  },

  menuLabel: {
    color: "#646b64",
    fontSize: 10,
    letterSpacing: 1.8,
    margin: "10px 10px 12px",
  },

  menuItem: {
    width: "100%",
    padding: "13px 12px",
    borderRadius: 9,
    color: "#929990",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 5,
    fontSize: 13,
    background: "transparent",
    border: "1px solid transparent",
    textAlign: "left",
    cursor: "pointer",
  },

  activeMenu: {
    background: "#242117",
    color: "#e5c46f",
    border: "1px solid #5b4821",
  },

  menuIcon: {
    width: 21,
    textAlign: "center",
    fontSize: 16,
  },

  sidebarBottom: {
    marginTop: "auto",
    paddingTop: 20,
  },

  adminBadge: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 8px",
    borderTop: "1px solid #252a25",
  },

  adminAvatar: {
    width: 35,
    height: 35,
    borderRadius: "50%",
    background: "#b99446",
    color: "#111",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
  },

  adminText: {
    fontSize: 12,
    fontWeight: 700,
  },

  adminEmail: {
    fontSize: 10,
    color: "#858c84",
    marginTop: 4,
    overflowWrap: "anywhere",
  },

  logout: {
    width: "100%",
    padding: 12,
    background: "#171a18",
    color: "#d0d4d0",
    border: "1px solid #2b302b",
    borderRadius: 8,
    marginTop: 8,
    cursor: "pointer",
  },

  main: {
    flex: 1,
    padding: "38px 34px",
    minWidth: 0,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 36,
  },

  breadcrumb: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#c7a654",
    marginBottom: 12,
  },

  heading: {
    fontSize: 28,
    margin: 0,
    fontWeight: 800,
  },

  subtitle: {
    color: "#858d85",
    fontSize: 13,
    marginTop: 10,
  },

  status: {
    border: "1px solid #31523b",
    background: "#14231a",
    color: "#8bd3a2",
    borderRadius: 30,
    padding: "10px 14px",
    fontSize: 10,
    letterSpacing: 0.8,
  },

  statusDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#64c881",
    marginRight: 8,
  },

  error: {
    background: "#311b1b",
    color: "#ffb5a9",
    border: "1px solid #6b3333",
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 12,
    overflowWrap: "anywhere",
  },

  sectionTitle: {
    color: "#929990",
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 16,
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 15,
  },

  card: {
    background: "#11151a",
    border: "1px solid #262b30",
    borderRadius: 14,
    padding: 20,
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  cardLabel: {
    fontSize: 10,
    color: "#89918b",
    letterSpacing: 1,
  },

  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    fontSize: 18,
  },

  cardValue: {
    fontSize: 30,
    fontWeight: 800,
    marginTop: 22,
  },

  cardFooter: {
    color: "#7d857e",
    fontSize: 10,
    marginTop: 13,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 16,
    marginTop: 26,
  },

  panel: {
    background: "#11151a",
    border: "1px solid #262b30",
    borderRadius: 14,
    padding: 22,
  },

  panelTitle: {
    fontSize: 15,
    margin: "0 0 18px",
  },

  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "14px 0",
    borderBottom: "1px solid #22282d",
    fontSize: 12,
  },

  statusRowLabel: {
    color: "#909891",
  },

  statusRowValue: {
    color: "#d2d8d2",
  },

  infoEmail: {
    color: "#8b938b",
    fontSize: 12,
    marginTop: 8,
    overflowWrap: "anywhere",
  },

  securityNote: {
    background: "#171e19",
    border: "1px solid #304332",
    borderRadius: 10,
    padding: 14,
    color: "#8cd2a0",
    fontSize: 11,
    lineHeight: 1.6,
  },

  usersHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  refreshButton: {
    background: "#292319",
    color: "#d7b563",
    border: "1px solid #5b4821",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },

  search: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0b0e12",
    color: "#fff",
    border: "1px solid #30353b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    outline: "none",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 650,
  },

  th: {
    textAlign: "left",
    padding: 12,
    fontSize: 10,
    color: "#d3b35f",
    letterSpacing: 1,
    borderBottom: "1px solid #30353b",
  },

  td: {
    padding: 12,
    fontSize: 12,
    color: "#d0d5d0",
    borderBottom: "1px solid #22282d",
  },

  tdUserId: {
    padding: 12,
    fontSize: 10,
    color: "#7f8981",
    borderBottom: "1px solid #22282d",
    wordBreak: "break-all",
  },

  empty: {
    textAlign: "center",
    padding: 30,
    color: "#8b938b",
    fontSize: 12,
  },

  footer: {
    borderTop: "1px solid #23282d",
    marginTop: 35,
    paddingTop: 20,
    color: "#59615b",
    fontSize: 10,
    letterSpacing: 1,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
};
