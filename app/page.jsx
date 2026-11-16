
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const plans = [
  { name: "STARTER", price: 10 },
  { name: "BASIC", price: 25 },
  { name: "PRO", price: 50 },
  { name: "PREMIUM", price: 100 },
  { name: "GOLD", price: 250 },
  { name: "PLATINUM", price: 500 },
  { name: "DIAMOND", price: 1000 },
  { name: "VIP", price: 2000 }
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);

  const [walletLoading, setWalletLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [investmentError, setInvestmentError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    setDataLoading(true);
    setWalletLoading(true);
    setWalletError("");
    setInvestmentError("");
    setTransactionError("");

    const [walletResult, transactionResult, investmentResult] =
      await Promise.all([
        supabase
          .from("wallets")
          .select("balance,currency,network")
          .eq("user_id", user.id)
          .eq("currency", "USDT")
          .eq("network", "BEP20")
          .maybeSingle(),

        supabase
          .from("transactions")
          .select(
            "id,type,amount,currency,network,status,price_amount,actually_paid,created_at,provider_payment_id"
          )
          .eq("user_id", user.id)
          .eq("type", "deposit")
          .order("created_at", { ascending: false })
          .limit(20),

        supabase
          .from("mining_plan_purchases")
          .select("id,status,principal_usdt")
          .eq("user_id", user.id)
      ]);

    if (walletResult.error) {
      setWalletError(walletResult.error.message);
    } else {
      setWallet(walletResult.data);
    }

    if (transactionResult.error) {
      setTransactionError(transactionResult.error.message);
    } else {
      setTransactions(transactionResult.data || []);
    }

    if (investmentResult.error) {
      setInvestmentError(investmentResult.error.message);
    } else {
      setInvestments(investmentResult.data || []);
    }

    setWalletLoading(false);
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboard();
    } else {
      setWallet(null);
      setTransactions([]);
      setInvestments([]);
    }
  }, [user, loadDashboard]);

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    setAuthMessage("");

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        setAuthMessage(
          data.session
            ? "Account created successfully."
            : "Registration successful. Please check your email to confirm your account."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setWallet(null);
    setTransactions([]);
    setInvestments([]);
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    return new Date(value).toLocaleString();
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();

    if (["active", "approved", "paid", "finished"].includes(value)) {
      return "approved";
    }

    if (["pending", "waiting", "confirming"].includes(value)) {
      return "pending";
    }

    return "other";
  }

  const confirmedDeposits = transactions
    .filter((item) => item.status === "approved")
    .reduce(
      (sum, item) =>
        sum + Number(item.actually_paid || item.amount || 0),
      0
    );

  const activeInvestments = investments.filter(
    (item) => item.status === "active"
  );

  const pendingInvestments = investments.filter(
    (item) => item.status === "pending"
  );

  const activeCapital = activeInvestments.reduce(
    (sum, item) => sum + Number(item.principal_usdt || 0),
    0
  );

  const pendingCapital = pendingInvestments.reduce(
    (sum, item) => sum + Number(item.principal_usdt || 0),
    0
  );

  const navigation = [
    ["overview", "▦", "Overview"],
    ["investments", "◈", "My Investments"],
    ["plans", "▤", "Investment Plans"],
    ["wallet", "◇", "My Wallet"],
    ["deposits", "↓", "Deposit History"],
    ["withdrawals", "↑", "Withdrawals"],
    ["account", "⚙", "Account"]
  ];

  return (
    <main className="app">
      <style jsx global>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          margin: 0;
          background: #080b0a;
          color: #f4f4ef;
          font-family: Arial, Helvetica, sans-serif;
        }
        button, input { font: inherit; }
        button { cursor: pointer; }
        .app {
          min-height: 100vh;
          background:
            radial-gradient(circle at 80% 0%, rgba(196,155,54,.10), transparent 28%),
            #080b0a;
        }
        .topbar {
          min-height: 76px;
          padding: 14px 5%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid #292d25;
          background: #0b0f0c;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: #10120c;
          background: linear-gradient(135deg,#f4d27b,#bd8b28);
          font-size: 23px;
          font-weight: 900;
        }
        .brand-name {
          color: #f0c45b;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .brand-tagline { color: #899087; font-size: 11px; margin-top: 4px; }
        .top-actions { display: flex; align-items: center; gap: 12px; }
        .user-email { color: #aab0a7; font-size: 12px; }
        .logout {
          padding: 10px 15px;
          border: 1px solid #4b4230;
          border-radius: 9px;
          color: #f0c45b;
          background: #171711;
        }
        .layout {
          display: grid;
          grid-template-columns: 225px minmax(0,1fr);
          max-width: 1550px;
          margin: auto;
          min-height: calc(100vh - 76px);
        }
        .sidebar {
          padding: 27px 16px;
          border-right: 1px solid #252a24;
          background: rgba(12,16,13,.8);
        }
        .side-label {
          margin: 8px 12px 15px;
          color: #70796f;
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1.5px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 13px 14px;
          margin-bottom: 7px;
          border: 0;
          border-radius: 9px;
          color: #b5bcb1;
          background: transparent;
          text-align: left;
          font-size: 13px;
        }
        .nav-link:hover, .nav-link.active {
          color: #f2cb68;
          background: #242115;
        }
        .main-content { min-width: 0; padding: 34px 4%; }
        .welcome-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 26px;
        }
        .eyebrow {
          color: #d7ad4c;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .page-title {
          margin: 9px 0;
          font-size: clamp(25px,4vw,35px);
          color: #f4f2e9;
        }
        .muted { color: #899087; font-size: 13px; line-height: 1.7; }
        .status-pill {
          padding: 9px 13px;
          border: 1px solid #28523a;
          border-radius: 30px;
          background: #10251a;
          color: #6edb91;
          font-size: 11px;
          font-weight: bold;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .stat-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #292d25;
          border-radius: 14px;
          background: linear-gradient(145deg,#171b16,#101410);
        }
        .stat-icon { font-size: 21px; margin-bottom: 15px; }
        .stat-label { color: #929a8f; font-size: 12px; }
        .stat-value {
          display: block;
          margin-top: 9px;
          color: #f0c45b;
          font-size: 21px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .stat-note { margin-top: 8px; color: #6e786e; font-size: 10px; }
        .content-grid {
          display: grid;
          grid-template-columns: minmax(0,1.4fr) minmax(260px,.8fr);
          gap: 18px;
          align-items: start;
        }
        .panel {
          min-width: 0;
          padding: 22px;
          margin-bottom: 18px;
          border: 1px solid #292d25;
          border-radius: 14px;
          background: #121712;
        }
        .panel h2 { margin: 0 0 7px; color: #f0c45b; font-size: 17px; }
        .panel h3 { color: #e9e9df; font-size: 14px; }
        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 17px;
        }
        .wallet-box {
          padding: 20px;
          margin-top: 17px;
          border: 1px solid #4a3d20;
          border-radius: 12px;
          background: linear-gradient(130deg,#292316,#151810);
        }
        .wallet-balance {
          margin: 10px 0;
          color: #f3cf71;
          font-size: clamp(27px,5vw,37px);
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .network-tag {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 7px;
          color: #7de09a;
          background: #173021;
          font-size: 11px;
        }
        .plan-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
          margin-top: 17px;
        }
        .plan-card {
          padding: 17px;
          border: 1px solid #39372b;
          border-radius: 11px;
          background: #171d17;
        }
        .plan-name {
          color: #d9bd70;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .plan-price {
          margin: 9px 0;
          color: #f4d27b;
          font-size: 24px;
          font-weight: 900;
        }
        .plan-description { color: #899087; font-size: 11px; line-height: 1.6; }
        .feature-card {
          padding: 17px;
          margin-top: 13px;
          border: 1px solid #30372e;
          border-radius: 11px;
          background: #171d17;
        }
        .feature-title { color: #e7c66e; font-weight: bold; font-size: 12px; }
        .feature-status { margin-top: 8px; color: #8e988c; font-size: 12px; line-height: 1.7; }
        .history-list { display: grid; gap: 11px; margin-top: 14px; }
        .history-item {
          padding: 15px;
          border: 1px solid #30372e;
          border-radius: 10px;
          background: #171d17;
          min-width: 0;
        }
        .history-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }
        .history-amount { color: #f0c45b; font-size: 16px; font-weight: 800; }
        .history-detail {
          margin-top: 7px;
          color: #899087;
          font-size: 11px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }
        .history-status {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: bold;
        }
        .history-status.approved {
          color: #73db91;
          background: #173021;
          border: 1px solid #28523a;
        }
        .history-status.pending {
          color: #f0c45b;
          background: #292316;
          border: 1px solid #4b4230;
        }
        .history-status.other {
          color: #c0c5bb;
          background: #252a24;
          border: 1px solid #394239;
        }
        .empty-history {
          padding: 24px 12px;
          text-align: center;
          color: #899087;
          font-size: 12px;
          border: 1px dashed #394239;
          border-radius: 10px;
        }
        .refresh-btn {
          padding: 9px 13px;
          border: 1px solid #4b4230;
          border-radius: 8px;
          color: #f0c45b;
          background: #1c1b13;
          font-size: 11px;
        }
        .error { margin-top: 12px; color: #ff8585; font-size: 12px; overflow-wrap: anywhere; }
        .footer { padding: 25px 10px; color: #687166; text-align: center; font-size: 11px; }
        .auth-wrap { min-height: calc(100vh - 76px); display: grid; place-items: center; padding: 25px; }
        .auth-card {
          width: 100%;
          max-width: 430px;
          padding: 30px;
          border: 1px solid #393322;
          border-radius: 17px;
          background: linear-gradient(145deg,#1a1d16,#101510);
        }
        .auth-card h1 { color: #f0c45b; font-size: 27px; }
        .form-label { display: block; margin: 17px 0 8px; color: #b8bdb3; font-size: 12px; }
        .field {
          display: block;
          width: 100%;
          padding: 14px;
          border: 1px solid #394239;
          border-radius: 9px;
          outline: none;
          background: #090e0a;
          color: white;
        }
        .field:focus { border-color: #d8ae4e; }
        .primary-btn {
          display: block;
          width: 100%;
          padding: 14px;
          margin-top: 14px;
          border: none;
          border-radius: 9px;
          color: #11130d;
          background: linear-gradient(135deg,#f3d47f,#c39636);
          font-weight: 900;
        }
        .primary-btn:disabled { opacity: .5; cursor: not-allowed; }
        .auth-switch { border: none; background: none; color: #f0c45b; font-weight: bold; }
        @media (max-width: 1000px) {
          .stats-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .content-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 650px) {
          .topbar { padding: 13px 16px; }
          .brand-name { font-size: 12px; }
          .brand-tagline { font-size: 10px; }
          .brand-icon { width: 37px; height: 37px; }
          .user-email { display: none; }
          .layout { display: block; }
          .sidebar {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding: 10px 12px;
            border-right: none;
            border-bottom: 1px solid #252a24;
          }
          .side-label { display: none; }
          .nav-link {
            flex: 0 0 auto;
            width: auto;
            margin: 0;
            padding: 11px 13px;
            font-size: 11px;
          }
          .main-content { padding: 24px 14px; }
          .stat-card { padding: 15px; }
          .stat-value { font-size: 18px; }
          .panel { padding: 17px; }
          .plan-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .auth-card { padding: 23px; }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">₿</div>
          <div>
            <div className="brand-name">CRYPTO MINING HUB</div>
            <div className="brand-tagline">Real Business. Transparent Investments.</div>
          </div>
        </div>

        {user && (
          <div className="top-actions">
            <span className="user-email">{user.email}</span>
            <button className="logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      {!user ? (
        <section className="auth-wrap">
          <div className="auth-card">
            <div className="eyebrow">CRYPTO MINING HUB</div>
            <h1>{mode === "login" ? "Welcome Back" : "Create Account"}</h1>
            <p className="muted">
              {mode === "login"
                ? "Login to access your investment dashboard."
                : "Create your investment platform account."}
            </p>

            <form onSubmit={handleAuth}>
              <label className="form-label">Email Address</label>
              <input
                className="field"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label className="form-label">Password</label>
              <input
                className="field"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading
                  ? "PLEASE WAIT..."
                  : mode === "login"
                    ? "LOGIN TO ACCOUNT"
                    : "CREATE ACCOUNT"}
              </button>
            </form>

            {authMessage && <p className="muted">{authMessage}</p>}

            <p className="muted" style={{ marginTop: 22 }}>
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                className="auth-switch"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setAuthMessage("");
                }}
              >
                {mode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </section>
      ) : (
        <div className="layout">
          <aside className="sidebar">
            <div className="side-label">INVESTOR MENU</div>
            {navigation.map(([id, icon, label]) => (
              <button
                key={id}
                className={`nav-link ${activeSection === id ? "active" : ""}`}
                onClick={() => {
                  setActiveSection(id);
                  document.getElementById(id)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </aside>

          <section className="main-content">
            <div className="welcome-row" id="overview">
              <div>
                <div className="eyebrow">INVESTOR ACCOUNT</div>
                <h1 className="page-title">Investment Dashboard</h1>
                <p className="muted">
                  Welcome back. Monitor your account and investment activity.
                </p>
              </div>
              <div className="status-pill">● ACCOUNT CONNECTED</div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-label">Wallet Balance</div>
                <div className="stat-value">
                  {walletLoading ? "..." : `${money(wallet?.balance)} USDT`}
                </div>
                <div className="stat-note">USDT · BEP20</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📥</div>
                <div className="stat-label">Confirmed Deposits</div>
                <div className="stat-value">
                  {money(confirmedDeposits)} USDT
                </div>
                <div className="stat-note">Approved deposits only</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-label">Active Investment</div>
                <div className="stat-value">
                  {money(activeCapital)} USDT
                </div>
                <div className="stat-note">
                  {activeInvestments.length} active record(s)
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-label">Pending Investment</div>
                <div className="stat-value">
                  {money(pendingCapital)} USDT
                </div>
                <div className="stat-note">
                  {pendingInvestments.length} pending record(s)
                </div>
              </div>
            </div>

            {walletError && <p className="error">Wallet: {walletError}</p>}
            {investmentError && (
              <p className="error">
                Investment records: {investmentError}
              </p>
            )}

            <div className="content-grid">
              <div>
                <div className="panel" id="investments">
                  <div className="section-heading">
                    <div>
                      <h2>My Investments</h2>
                      <p className="muted">
                        Your investment records and their current status.
                      </p>
                    </div>
                    <button
                      className="refresh-btn"
                      onClick={loadDashboard}
                      disabled={dataLoading}
                    >
                      {dataLoading ? "LOADING..." : "↻ REFRESH"}
                    </button>
                  </div>

                  {dataLoading && investments.length === 0 ? (
                    <p className="muted">Loading investment records...</p>
                  ) : investments.length === 0 ? (
                    <div className="empty-history">
                      No investment records found. Your confirmed investment
                      records will appear here.
                    </div>
                  ) : (
                    <div className="history-list">
                      {investments.map((item) => (
                        <div className="history-item" key={item.id}>
                          <div className="history-top">
                            <div>
                              <div className="history-amount">
                                {money(item.principal_usdt)} USDT
                              </div>
                              <div className="history-detail">
                                Investment record
                              </div>
                            </div>
                            <span
                              className={`history-status ${statusClass(item.status)}`}
                            >
                              {item.status || "Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="muted" style={{ marginTop: 15 }}>
                    Only verified and activated investment records are counted
                    as active capital.
                  </p>
                </div>

                <div className="panel" id="plans">
                  <h2>Investment Plans</h2>
                  <p className="muted">
                    Available plan levels. Selecting a plan does not create an
                    investment or charge your account.
                  </p>

                  <div className="plan-grid">
                    {plans.map((plan) => (
                      <div className="plan-card" key={plan.name}>
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-price">
                          ${plan.price.toLocaleString("en-US")}
                        </div>
                        <div className="plan-description">
                          Investment tier · USDT
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" id="deposits">
                  <div className="section-heading">
                    <div>
                      <h2>Deposit History</h2>
                      <p className="muted">
                        Your latest deposit records.
                      </p>
                    </div>
                  </div>

                  {transactionError && (
                    <p className="error">{transactionError}</p>
                  )}

                  {transactions.length === 0 ? (
                    <div className="empty-history">
                      No deposit records found.
                    </div>
                  ) : (
                    <div className="history-list">
                      {transactions.map((item) => (
                        <div className="history-item" key={item.id}>
                          <div className="history-top">
                            <div>
                              <div className="history-amount">
                                {item.price_amount != null
                                  ? `$${money(item.price_amount)} USD`
                                  : `${money(item.amount)} ${item.currency || "USDT"}`}
                              </div>
                              <div className="history-detail">
                                {formatDate(item.created_at)}
                              </div>
                            </div>
                            <span
                              className={`history-status ${statusClass(item.status)}`}
                            >
                              {item.status || "Pending"}
                            </span>
                          </div>
                          <div className="history-detail">
                            Network: {item.network || "Not specified"}
                          </div>
                          {item.provider_payment_id && (
                            <div className="history-detail">
                              Payment ID: {item.provider_payment_id}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="panel" id="wallet">
                  <h2>My Wallet</h2>
                  <p className="muted">
                    Your account wallet balance.
                  </p>

                  <div className="wallet-box">
                    <div className="muted">AVAILABLE BALANCE</div>
                    <div className="wallet-balance">
                      {walletLoading
                        ? "Loading..."
                        : `${money(wallet?.balance)} USDT`}
                    </div>
                    <span className="network-tag">
                      ● BNB Smart Chain · BEP20
                    </span>
                  </div>

                  {!walletLoading && !wallet && !walletError && (
                    <p className="muted">
                      No wallet record was found for this account.
                    </p>
                  )}
                </div>

                <div className="panel" id="withdrawals">
                  <h2>Withdrawals</h2>
                  <p className="muted">
                    Review withdrawal service information.
                  </p>
                  <div className="feature-card">
                    <div className="feature-title">USDT · BEP20</div>
                    <div className="feature-status">
                      Withdrawal requests and approval workflow will be
                      connected after the wallet and compliance checks are
                      completed.
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h2>Profit & Loss</h2>
                  <p className="muted">
                    Investment performance summary.
                  </p>
                  <div className="feature-card">
                    <div className="feature-title">VERIFIED PERFORMANCE</div>
                    <div className="feature-status">
                      No verified profit or loss figures are currently
                      available. This section will display actual recorded
                      business results when connected.
                    </div>
                  </div>
                </div>

                <div className="panel" id="account">
                  <h2>Account Information</h2>
                  <p className="muted">Signed in as:</p>
                  <p style={{ overflowWrap: "anywhere" }}>{user.email}</p>
                  <span className="network-tag">● Supabase Account</span>
                </div>
              </div>
            </div>

            <footer className="footer">
              © {new Date().getFullYear()} Crypto Mining Hub. All rights reserved.
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
