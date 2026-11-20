
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
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
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
    } catch (err) {
      setError(err?.message || "Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const [
      usersResult,
      transactionsResult,
      investmentsResult,
      withdrawalsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("transactions").select("*", { count: "exact", head: true }),
      supabase.from("mining_plan_purchases").select("*", { count: "exact", head: true }),
      supabase.from("mining_withdrawals").select("*", { count: "exact", head: true }),
    ]);

    setStats({
      users: usersResult.count || 0,
      transactions: transactionsResult.count || 0,
      investments: investmentsResult.count || 0,
      withdrawals: withdrawalsResult.count || 0,
    });

    const errors = [
      usersResult.error,
      transactionsResult.error,
      investmentsResult.error,
      withdrawalsResult.error,
    ].filter(Boolean);

    if (errors.length) {
      setError(errors.map((e) => e.message).join(" | "));
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  const cards = [
    {
      label: "TOTAL USERS",
      value: stats.users,
      icon: "♙",
      color: "#e6bd65",
    },
    {
      label: "TRANSACTIONS",
      value: stats.transactions,
      icon: "⇄",
      color: "#64d6ae",
    },
    {
      label: "MINING INVESTMENTS",
      value: stats.investments,
      icon: "◆",
      color: "#b79cff",
    },
    {
      label: "WITHDRAWAL REQUESTS",
      value: stats.withdrawals,
      icon: "↑",
      color: "#ff9b72",
    },
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

        {menu.map((item, index) => (
          <div
            key={item.name}
            style={{
              ...styles.menuItem,
              ...(index === 0 ? styles.activeMenu : {}),
            }}
          >
            <span style={styles.menuIcon}>{item.icon}</span>
            {item.name}
          </div>
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
            <div style={styles.breadcrumb}>ADMIN / OVERVIEW</div>
            <h1 style={styles.heading}>Admin Dashboard</h1>
            <p style={styles.subtitle}>
              Manage and monitor your Crypto Mining Hub platform.
            </p>
          </div>

          <div style={styles.status}>
            <span style={styles.statusDot}></span>
            ADMIN ACCESS VERIFIED
          </div>
        </header>

        {error && (
          <div style={styles.error}>
            ⚠ {error}
            <button onClick={loadStats} style={styles.retry}>
              Retry
            </button>
          </div>
        )}

        <div style={styles.sectionTitle}>PLATFORM OVERVIEW</div>

        <div style={styles.cards}>
          {cards.map((card) => (
            <div key={card.label} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.cardLabel}>{card.label}</div>
                <div
                  style={{
                    ...styles.cardIcon,
                    color: card.color,
                    background: `${card.color}15`,
                  }}
                >
                  {card.icon}
                </div>
              </div>

              <div style={styles.cardValue}>{card.value.toLocaleString()}</div>
              <div style={styles.cardFooter}>
                <span style={{ color: card.color }}>●</span> Database count
              </div>
            </div>
          ))}
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2>Platform Status</h2>
              <span style={styles.live}>● LIVE</span>
            </div>

            {[
              ["Authentication", "Connected"],
              ["Admin Security", "Verified"],
              ["Database", "Connected"],
              ["Platform", "Crypto Mining Hub"],
            ].map(([label, value]) => (
              <div key={label} style={styles.statusRow}>
                <span style={styles.statusRowLabel}>{label}</span>
                <span style={styles.statusRowValue}>
                  <span style={styles.greenDot}></span>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2>Admin Information</h2>
            </div>

            <div style={styles.adminInfo}>
              <div style={styles.infoIcon}>♙</div>
              <div>
                <div style={styles.infoTitle}>Administrator Account</div>
                <div style={styles.infoEmail}>{adminEmail}</div>
              </div>
            </div>

            <div style={styles.securityNote}>
              <span>♢</span>
              <div>
                <strong>SECURITY ACTIVE</strong>
                <p>
                  This page checks the authenticated user against the admin_users
                  table before displaying the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

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
    padding: "13px 12px",
    borderRadius: 9,
    color: "#929990",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 5,
    fontSize: 13,
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
  retry: {
    marginLeft: 12,
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #744444",
    background: "#472626",
    color: "#fff",
    cursor: "pointer",
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
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  panelHeader h2: {
    fontSize: 15,
    margin: 0,
  },
  live: {
    fontSize: 10,
    color: "#72c891",
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
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#69c78a",
  },
  adminInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0 20px",
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "#292319",
    color: "#d7b563",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: 700,
  },
  infoEmail: {
    fontSize: 11,
    color: "#8b938b",
    marginTop: 5,
    overflowWrap: "anywhere",
  },
  securityNote: {
    display: "flex",
    gap: 12,
    background: "#171e19",
    border: "1px solid #304332",
    borderRadius: 10,
    padding: 14,
    color: "#8cd2a0",
    fontSize: 12,
  },
  securityNote p: {
    color: "#9ba79d",
    lineHeight: 1.6,
    margin: "8px 0 0",
    fontSize: 11,
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

