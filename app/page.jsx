"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const plans = [
  { name: "STARTER", price: 10 },
  { name: "BASIC", price: 25 },
  { name: "PRO", price: 50 },
  { name: "PREMIUM", price: 100 },
  { name: "GOLD", price: 250 },
  { name: "PLATINUM", price: 500 },
  { name: "DIAMOND", price: 1000 },
  { name: "VIP", price: 2000 },
];

const nav = [
  ["overview", "Overview"],
  ["investments", "My Investments"],
  ["plans", "Plans"],
  ["deposit", "Deposit"],
  ["wallet", "Wallet"],
  ["deposits", "Deposit History"],
  ["withdrawals", "Withdrawals"],
  ["account", "Account"],
];

const money = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateText = (v) => (v ? new Date(v).toLocaleString() : "—");

const statusClass = (s) => {
  const status = String(s || "").toLowerCase();

  if (["approved", "active", "finished", "paid"].includes(status))
    return "ok";

  if (["pending", "waiting", "confirming"].includes(status))
    return "pending";

  return "other";
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [section, setSection] = useState("overview");
  const [wallet, setWallet] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [depositAmount, setDepositAmount] = useState("20");
  const [payment, setPayment] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setLoadError("");

    const [w, d, p] = await Promise.all([
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
        .limit(50),

      supabase
        .from("mining_plan_purchases")
        .select(
          "id,plan_name,status,principal_usdt,price_usdt,created_at,activated_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const errors = [w.error, d.error, p.error]
      .filter(Boolean)
      .map((e) => e.message);

    if (w.error) setWallet(null);
    else setWallet(w.data);

    if (d.error) setDeposits([]);
    else setDeposits(d.data || []);

    if (p.error) setPurchases([]);
    else setPurchases(p.data || []);

    if (errors.length) setLoadError(errors.join(" • "));

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setWallet(null);
      setDeposits([]);
      setPurchases([]);
    }
  }, [user, loadData]);

  async function authSubmit(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg("");

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setAuthMsg(
          data.session
            ? "Account created successfully."
            : "Account created. Please check your email to confirm."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setAuthMsg(err.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setPayment(null);
  }

  async function getToken() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session?.access_token) {
      throw new Error("Session expired. Please login again.");
    }

    return data.session.access_token;
  }

  async function createDeposit(e) {
    e?.preventDefault();

    setBusyAction("deposit");
    setActionMsg("");
    setPayment(null);

    try {
      const access = await getToken();

      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          amount: Number(depositAmount),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Deposit creation failed."
        );
      }

      setPayment({
        ...result,
        kind: "deposit",
        amount: Number(depositAmount),
      });

      setActionMsg(
        "Payment instructions created. Send only the amount displayed below."
      );
    } catch (err) {
      setActionMsg(err.message || "Deposit request failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function buyPlan(plan) {
    setBusyAction(plan.name);
    setActionMsg("");
    setPayment(null);

    try {
      const access = await getToken();

      const response = await fetch("/api/plan-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          plan_name: plan.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Plan payment could not be created."
        );
      }

      setPayment({
        ...result,
        kind: "plan",
        amount: plan.price,
        planName: plan.name,
      });

      setActionMsg(
        "Payment created. Your plan activates after payment confirmation."
      );
    } catch (err) {
      setActionMsg(err.message || "Plan purchase failed.");
    } finally {
      setBusyAction("");
    }
  }

  const approvedDeposits = useMemo(
    () =>
      deposits.filter((x) =>
        ["approved", "finished"].includes(
          String(x.status || "").toLowerCase()
        )
      ),
    [deposits]
  );

  const depositTotal = approvedDeposits.reduce(
    (sum, x) => sum + Number(x.actually_paid || x.amount || 0),
    0
  );

  const activePlans = purchases.filter(
    (x) => String(x.status).toLowerCase() === "active"
  );

  const pendingPlans = purchases.filter(
    (x) => String(x.status).toLowerCase() === "pending"
  );

  const activeAmount = activePlans.reduce(
    (sum, x) =>
      sum + Number(x.principal_usdt || x.price_usdt || 0),
    0
  );

  const pendingAmount = pendingPlans.reduce(
    (sum, x) => sum + Number(x.price_usdt || 0),
    0
  );

  function go(id) {
    setSection(id);
    setPayment(null);
    setActionMsg("");

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="cmh">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #080b0a;
          color: #f4f4ef;
          font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .cmh {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 85% 0,
              rgba(194, 155, 54, 0.1),
              transparent 30%
            ),
            #080b0a;
        }

        .top {
          min-height: 70px;
          padding: 13px 4%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #292d25;
          background: #0b0f0c;
        }

        .brand {
          display: flex;
          gap: 11px;
          align-items: center;
        }

        .logo {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #f4d27b, #bd8b28);
          color: #14140d;
          font-weight: 900;
          font-size: 22px;
        }

        .brand-title {
          font-weight: 900;
          color: #f0c45b;
          letter-spacing: 0.8px;
          font-size: 14px;
        }

        .tagline {
          font-size: 10px;
          color: #879086;
          margin-top: 4px;
        }

        .topright {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .email {
          font-size: 11px;
          color: #aab0a7;
          max-width: 200px;
          overflow-wrap: anywhere;
        }

        .logout,
        .secondary {
          padding: 9px 13px;
          border: 1px solid #4b4230;
          border-radius: 8px;
          color: #efc45b;
          background: #171711;
        }

        .layout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          max-width: 1500px;
          margin: auto;
          min-height: calc(100vh - 70px);
        }

        .side {
          padding: 23px 14px;
          border-right: 1px solid #252a24;
          background: #0c100d;
        }

        .side-caption {
          font-size: 10px;
          color: #71796f;
          letter-spacing: 1.4px;
          margin: 8px 10px 14px;
        }

        .navbtn {
          width: 100%;
          display: flex;
          text-align: left;
          gap: 10px;
          padding: 12px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #b5bcb1;
          font-size: 12px;
          margin: 4px 0;
        }

        .navbtn.active,
        .navbtn:hover {
          color: #f2cb68;
          background: #242115;
        }

        .main {
          padding: 30px 4%;
          min-width: 0;
        }

        .welcome {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 22px;
        }

        .eyebrow {
          font-size: 10px;
          letter-spacing: 2px;
          color: #d7ad4c;
          font-weight: bold;
        }

        .h1 {
          font-size: clamp(24px, 4vw, 34px);
          margin: 8px 0;
          color: #f3f1e8;
        }

        .muted {
          font-size: 12px;
          color: #899087;
          line-height: 1.65;
        }

        .connected {
          border: 1px solid #28523a;
          background: #10251a;
          color: #70dc92;
          border-radius: 30px;
          padding: 8px 12px;
          font-size: 10px;
          font-weight: bold;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .stat,
        .panel,
        .plan {
          border: 1px solid #292d25;
          border-radius: 13px;
          background: #131813;
        }

        .stat {
          padding: 16px;
          min-width: 0;
        }

        .statlabel {
          color: #929a8f;
          font-size: 11px;
        }

        .statvalue {
          display: block;
          margin-top: 8px;
          color: #f0c45b;
          font-weight: 900;
          font-size: 19px;
          overflow-wrap: anywhere;
        }

        .statnote {
          margin-top: 7px;
          font-size: 10px;
          color: #6e786e;
        }

        .columns {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(250px, 0.8fr);
          gap: 16px;
          align-items: start;
        }

        .panel {
          padding: 19px;
          margin-bottom: 16px;
          min-width: 0;
        }

        .panel h2 {
          font-size: 16px;
          color: #f0c45b;
          margin: 0 0 7px;
        }

        .panel h3 {
          font-size: 13px;
          color: #eee;
          margin: 0 0 8px;
        }

        .panelhead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .walletbox {
          margin-top: 13px;
          padding: 19px;
          border: 1px solid #4a3d20;
          border-radius: 11px;
          background: linear-gradient(130deg, #292316, #151810);
        }

        .balance {
          font-size: clamp(25px, 5vw, 35px);
          font-weight: 900;
          color: #f3cf71;
          margin: 10px 0;
          overflow-wrap: anywhere;
        }

        .network {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 7px;
          color: #7de09a;
          background: #173021;
          font-size: 10px;
        }

        .plans {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
          margin-top: 15px;
        }

        .plan {
          padding: 15px;
          background: #171d17;
        }

        .planname {
          color: #d9bd70;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .price {
          margin: 8px 0;
          color: #f4d27b;
          font-size: 23px;
          font-weight: 900;
        }

        .planhint {
          color: #899087;
          font-size: 10px;
          margin-bottom: 12px;
        }

        .label {
          display: block;
          margin: 14px 0 7px;
          color: #b8bdb3;
          font-size: 11px;
        }

        .field {
          display: block;
          width: 100%;
          padding: 13px;
          border: 1px solid #394239;
          border-radius: 9px;
          outline: none;
          background: #090e0a;
          color: white;
        }

        .field:focus {
          border-color: #d8ae4e;
        }

        .primary {
          display: block;
          width: 100%;
          padding: 13px;
          margin-top: 12px;
          border: none;
          border-radius: 9px;
          color: #11130d;
          background: linear-gradient(135deg, #f3d47f, #c39636);
          font-weight: 900;
        }

        .primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .list {
          display: grid;
          gap: 10px;
          margin-top: 13px;
        }

        .item {
          padding: 14px;
          border: 1px solid #30372e;
          border-radius: 10px;
          background: #171d17;
          min-width: 0;
        }

        .itemtop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .itemamount {
          color: #f0c45b;
          font-size: 14px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .detail {
          margin-top: 7px;
          color: #899087;
          font-size: 10px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .badge {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: bold;
        }

        .badge.ok {
          color: #73db91;
          background: #173021;
          border: 1px solid #28523a;
        }

        .badge.pending {
          color: #f0c45b;
          background: #292316;
          border: 1px solid #4b4230;
        }

        .badge.other {
          color: #c0c5bb;
          background: #252a24;
          border: 1px solid #394239;
        }

        .empty {
          border: 1px dashed #394239;
          border-radius: 9px;
          padding: 22px;
          text-align: center;
          color: #899087;
          font-size: 11px;
        }

        .message {
          font-size: 12px;
          color: #8bd6a0;
          margin-top: 10px;
          overflow-wrap: anywhere;
        }

        .error {
          font-size: 12px;
          color: #ff8585;
          margin-top: 10px;
          overflow-wrap: anywhere;
        }

        .paybox {
          border: 1px solid #80672c;
          background: #211d13;
          border-radius: 10px;
          padding: 14px;
          margin-top: 14px;
          overflow-wrap: anywhere;
        }

        .payvalue {
          word-break: break-all;
          background: #090e0a;
          padding: 10px;
          border-radius: 7px;
          margin-top: 7px;
          font-size: 11px;
          color: #f3d27b;
        }

        .copybtn {
          border: 1px solid #4b4230;
          border-radius: 7px;
          background: #171711;
          color: #f0c45b;
          padding: 8px 10px;
          margin-top: 8px;
          font-size: 11px;
        }

        .smallnote {
          font-size: 10px;
          color: #899087;
          line-height: 1.6;
          margin-top: 10px;
        }

        .footer {
          text-align: center;
          color: #687166;
          font-size: 10px;
          padding: 20px;
        }

        .withdrawnote {
          padding: 14px;
          border: 1px solid #3a3d30;
          border-radius: 10px;
          background: #171d17;
          color: #aab0a7;
          font-size: 12px;
          line-height: 1.65;
        }

        .authbox {
          min-height: 80vh;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .authpanel {
          width: 100%;
          max-width: 430px;
          padding: 26px;
        }

        @media (max-width: 980px) {
          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .columns {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .top {
            padding: 12px;
          }

          .brand-title {
            font-size: 11px;
          }

          .logo {
            width: 36px;
            height: 36px;
          }

          .email {
            display: none;
          }

          .layout {
            display: block;
          }

          .side {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding: 8px;
            border-right: 0;
            border-bottom: 1px solid #252a24;
          }

          .side-caption {
            display: none;
          }

          .navbtn {
            flex: 0 0 auto;
            width: auto;
            margin: 0;
            padding: 10px;
            font-size: 10px;
          }

          .main {
            padding: 20px 12px;
          }

          .stat {
            padding: 13px;
          }

          .statvalue {
            font-size: 16px;
          }

          .panel {
            padding: 15px;
          }

          .plans {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <header className="top">
        <div className="brand">
          <div className="logo">₿</div>
          <div>
            <div className="brand-title">CRYPTO MINING HUB</div>
            <div className="tagline">Transparent account dashboard</div>
          </div>
        </div>

        {user && (
          <div className="topright">
            <span className="email">{user.email}</span>
            <button className="logout" onClick={logout}>
              Logout
            </button>
          </div>
        )}
      </header>

      {!user ? (
        <section className="authbox">
          <div className="panel authpanel">
            <div className="eyebrow">CRYPTO MINING HUB</div>

            <h1 className="h1">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>

            <p className="muted">
              {mode === "login"
                ? "Sign in to view your account."
                : "Register for your account."}
            </p>

            <form onSubmit={authSubmit}>
              <label className="label">Email</label>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
              />

              <label className="label">Password</label>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                placeholder="Password"
              />

              <button className="primary" disabled={authBusy}>
                {authBusy
                  ? "PLEASE WAIT..."
                  : mode === "login"
                    ? "LOGIN"
                    : "CREATE ACCOUNT"}
              </button>
            </form>

            {authMsg && <p className="muted">{authMsg}</p>}

            <p className="muted" style={{ marginTop: 16 }}>
              {mode === "login" ? "New here?" : "Already registered?"}{" "}
              <button
                className="copybtn"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setAuthMsg("");
                }}
              >
                {mode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </section>
      ) : (
        <div className="layout">
          <aside className="side">
            <div className="side-caption">ACCOUNT MENU</div>

            {nav.map(([id, label]) => (
              <button
                key={id}
                className={`navbtn ${section === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                {label}
              </button>
            ))}
          </aside>

          <section className="main">
            <div className="welcome" id="overview">
              <div>
                <div className="eyebrow">ACCOUNT OVERVIEW</div>
                <h1 className="h1">Your Dashboard</h1>
                <p className="muted">
                  Welcome back. Review your account activity and payment records.
                </p>
              </div>

              <span className="connected">● SIGNED IN</span>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="statlabel">Wallet Balance</div>
                <span className="statvalue">
                  {loading ? "Loading..." : `${money(wallet?.balance)} USDT`}
                </span>
                <div className="statnote">USDT · BEP20</div>
              </div>

              <div className="stat">
                <div className="statlabel">Confirmed Deposits</div>
                <span className="statvalue">{money(depositTotal)} USDT</span>
                <div className="statnote">Approved/finished deposits</div>
              </div>

              <div className="stat">
                <div className="statlabel">Active Plans</div>
                <span className="statvalue">{activePlans.length}</span>
                <div className="statnote">
                  {money(activeAmount)} USDT recorded
                </div>
              </div>

              <div className="stat">
                <div className="statlabel">Pending Plans</div>
                <span className="statvalue">{pendingPlans.length}</span>
                <div className="statnote">
                  {money(pendingAmount)} USDT pending
                </div>
              </div>
            </div>

            {loadError && <p className="error">Data issue: {loadError}</p>}

            <div className="columns">
              <div>
                <div className="panel" id="investments">
                  <div className="panelhead">
                    <div>
                      <h2>My Investments</h2>
                      <p className="muted">
                        Your plan purchase records and their current status.
                      </p>
                    </div>

                    <button
                      className="secondary"
                      onClick={loadData}
                      disabled={loading}
                    >
                      {loading ? "Loading..." : "↻ Refresh"}
                    </button>
                  </div>

                  {purchases.length === 0 ? (
                    <div className="empty">
                      No investment records found.
                    </div>
                  ) : (
                    <div className="list">
                      {purchases.map((p) => (
                        <div className="item" key={p.id}>
                          <div className="itemtop">
                            <div className="itemamount">
                              {p.plan_name || "Plan"} · $
                              {money(p.price_usdt || p.principal_usdt)}
                            </div>

                            <span
                              className={`badge ${statusClass(p.status)}`}
                            >
                              {p.status || "Unknown"}
                            </span>
                          </div>

                          <div className="detail">
                            Created: {dateText(p.created_at)}
                            {p.activated_at
                              ? ` · Activated: ${dateText(p.activated_at)}`
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel" id="plans">
                  <h2>Investment Plans</h2>

                  <p className="muted">
                    Plan payment uses USDT on BEP20. Payment must be confirmed
                    before a plan is activated.
                  </p>

                  <div className="plans">
                    {plans.map((plan) => (
                      <div className="plan" key={plan.name}>
                        <div className="planname">{plan.name}</div>

                        <div className="price">
                          ${plan.price.toLocaleString("en-US")}
                        </div>

                        <div className="planhint">USDT · BEP20</div>

                        <button
                          className="primary"
                          onClick={() => buyPlan(plan)}
                          disabled={!!busyAction}
                        >
                          {busyAction === plan.name
                            ? "CREATING PAYMENT..."
                            : "BUY PLAN"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" id="deposit">
                  <h2>Make a Deposit</h2>

                  <p className="muted">
                    Deposit payment is currently configured for USDT on BNB
                    Smart Chain (BEP20).
                  </p>

                  <form onSubmit={createDeposit}>
                    <label className="label">Deposit Amount (USD)</label>

                    <input
                      className="field"
                      type="number"
                      min="1"
                      max="10000"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      required
                    />

                    <button className="primary" disabled={!!busyAction}>
                      {busyAction === "deposit"
                        ? "CREATING PAYMENT..."
                        : "CREATE DEPOSIT PAYMENT"}
                    </button>
                  </form>

                  {actionMsg && <p className="message">{actionMsg}</p>}

                  {payment && (
                    <div className="paybox">
                      <strong>
                        {payment.kind === "plan"
                          ? `${payment.planName} Payment`
                          : "Deposit Payment"}
                      </strong>

                      <div className="detail">
                        Send exactly the requested amount using the network
                        shown by the payment provider.
                      </div>

                      <div className="label">Amount to Send</div>

                      <div className="payvalue">
                        {payment.pay_amount} {payment.pay_currency || "USDT"}
                      </div>

                      <div className="label">Payment Address</div>

                      <div className="payvalue">
                        {payment.pay_address || "Address not returned"}
                      </div>

                      {payment.payment_id && (
                        <div className="detail">
                          Payment ID: {payment.payment_id}
                        </div>
                      )}

                      {payment.order_id && (
                        <div className="detail">
                          Order ID: {payment.order_id}
                        </div>
                      )}

                      <button
                        type="button"
                        className="copybtn"
                        onClick={() =>
                          navigator.clipboard?.writeText(
                            payment.pay_address || ""
                          )
                        }
                      >
                        Copy Address
                      </button>

                      <p className="smallnote">
                        Verify the address, amount, and network before sending.
                        Wait for payment confirmation.
                      </p>
                    </div>
                  )}
                </div>

                <div className="panel" id="deposits">
                  <h2>Deposit History</h2>

                  {deposits.length === 0 ? (
                    <div className="empty">No deposit records found.</div>
                  ) : (
                    <div className="list">
                      {deposits.map((d) => (
                        <div className="item" key={d.id}>
                          <div className="itemtop">
                            <span className="itemamount">
                              ${money(d.price_amount ?? d.amount)}
                            </span>

                            <span
                              className={`badge ${statusClass(d.status)}`}
                            >
                              {d.status || "Pending"}
                            </span>
                          </div>

                          <div className="detail">
                            {d.currency || "USDT"} · {d.network || "Network not set"} ·{" "}
                            {dateText(d.created_at)}
                          </div>

                          {d.provider_payment_id && (
                            <div className="detail">
                              Payment ID: {d.provider_payment_id}
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
                    Balance for your USDT BEP20 wallet.
                  </p>

                  <div className="walletbox">
                    <div className="muted">AVAILABLE BALANCE</div>

                    <div className="balance">
                      {loading
                        ? "Loading..."
                        : `${money(wallet?.balance)} USDT`}
                    </div>

                    <span className="network">
                      BNB Smart Chain · BEP20
                    </span>
                  </div>

                  {!wallet && !loading && (
                    <p className="muted">Wallet record not found.</p>
                  )}
                </div>

                <div className="panel" id="withdrawals">
                  <h2>Withdrawals</h2>

                  <p className="muted">Withdrawal network: USDT BEP20.</p>

                  <div className="withdrawnote">
                    Withdrawal is not enabled yet. The server must first
                    validate available funds, reserve the balance, prevent
                    duplicate requests, and track approval before funds
                    can be sent.
                  </div>
                </div>

                <div className="panel">
                  <h2>Profit & Loss</h2>

                  <p className="muted">Verified business results only.</p>

                  <div className="withdrawnote">
                    No verified profit or loss data is connected yet.
                    Actual recorded results will be shown when available.
                    No projected or guaranteed earnings are displayed.
                  </div>
                </div>

                <div className="panel" id="account">
                  <h2>Account</h2>

                  <p className="muted">Signed in email</p>

                  <div style={{ overflowWrap: "anywhere", margin: "12px 0" }}>
                    {user.email}
                  </div>

                  <span className="network">
                    Supabase authenticated account
                  </span>

                  <button
                    className="secondary"
                    style={{ marginTop: 14 }}
                    onClick={logout}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            <footer className="footer">
              © {new Date().getFullYear()} Crypto Mining Hub
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}