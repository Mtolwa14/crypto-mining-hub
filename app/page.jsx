
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositInfo, setDepositInfo] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      return;
    }

    let active = true;

    async function loadWallet() {
      setWalletLoading(true);
      setWalletError("");

      const { data, error } = await supabase
        .from("wallets")
        .select("balance, currency, network")
        .eq("user_id", user.id)
        .eq("currency", "USDT")
        .eq("network", "BEP20")
        .maybeSingle();

      if (!active) return;

      if (error) {
        setWalletError(error.message);
      } else {
        setWallet(data);
      }

      setWalletLoading(false);
    }

    loadWallet();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

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

        if (!data.session) {
          setMessage(
            "Registration successful! Check your email to confirm your account."
          );
        } else {
          setMessage("Account created successfully!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setWallet(null);
    setDepositInfo(null);
  }

  async function handleDeposit(e) {
    e.preventDefault();

    const amount = Number(depositAmount);

    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      setDepositError("Enter an amount between 1 and 10,000 USD.");
      return;
    }

    setDepositLoading(true);
    setDepositError("");
    setDepositInfo(null);
    setCopyMessage("");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Please log in again.");
      }

      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ amount })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Deposit request failed.");
      }

      setDepositInfo(result);
    } catch (error) {
      setDepositError(error.message);
    } finally {
      setDepositLoading(false);
    }
  }

  async function copyAddress() {
    if (!depositInfo?.pay_address) return;

    try {
      await navigator.clipboard.writeText(depositInfo.pay_address);
      setCopyMessage("Address copied successfully!");
    } catch {
      setCopyMessage("Please copy the address manually.");
    }
  }

  const money = Number(wallet?.balance || 0).toFixed(2);

  return (
    <main className="app">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #080b0a;
          color: #f4f4ef;
          font-family: Arial, Helvetica, sans-serif;
        }

        button, input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(circle at 80% 0%, rgba(196, 155, 54, .10), transparent 28%),
            #080b0a;
          color: #f4f4ef;
        }

        .topbar {
          min-height: 76px;
          padding: 16px 5%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          border-bottom: 1px solid #252a24;
          background: rgba(10, 13, 11, .95);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: #10120c;
          background: linear-gradient(135deg, #f4d27b, #bd8b28);
          font-size: 24px;
          font-weight: 900;
        }

        .brand-name {
          color: #f0c45b;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .brand-tagline {
          color: #899087;
          font-size: 11px;
          margin-top: 4px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-email {
          color: #aab0a7;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .logout {
          border: 1px solid #4b4230;
          border-radius: 9px;
          padding: 10px 15px;
          color: #f0c45b;
          background: #171711;
        }

        .layout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          max-width: 1500px;
          margin: auto;
          min-height: calc(100vh - 76px);
        }

        .sidebar {
          padding: 28px 17px;
          border-right: 1px solid #252a24;
          background: rgba(12, 16, 13, .8);
        }

        .side-label {
          margin: 8px 12px 15px;
          color: #70796f;
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1.5px;
        }

        .nav-link {
          display: block;
          padding: 13px 14px;
          margin-bottom: 7px;
          border-radius: 9px;
          text-decoration: none;
          color: #b5bcb1;
          font-size: 13px;
        }

        .nav-link:hover,
        .nav-link.active {
          color: #f2cb68;
          background: #242115;
        }

        .main-content {
          min-width: 0;
          padding: 35px 4%;
        }

        .welcome-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 27px;
        }

        .eyebrow {
          color: #d7ad4c;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
        }

        .page-title {
          margin: 9px 0;
          font-size: clamp(24px, 4vw, 34px);
          color: #f4f2e9;
        }

        .muted {
          color: #899087;
          font-size: 13px;
          line-height: 1.7;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 13px;
          border: 1px solid #28523a;
          border-radius: 30px;
          background: #10251a;
          color: #6edb91;
          font-size: 11px;
          font-weight: bold;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          background: #51d47d;
          border-radius: 50%;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 24px;
        }

        .stat-card {
          padding: 21px;
          min-width: 0;
          border: 1px solid #292d25;
          border-radius: 14px;
          background: linear-gradient(145deg, #171b16, #101410);
        }

        .stat-icon {
          font-size: 22px;
          margin-bottom: 17px;
        }

        .stat-label {
          color: #929a8f;
          font-size: 12px;
        }

        .stat-value {
          margin-top: 9px;
          color: #f0c45b;
          font-size: 22px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .stat-note {
          margin-top: 8px;
          color: #6e786e;
          font-size: 10px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(250px, .85fr);
          gap: 18px;
          align-items: start;
        }

        .panel {
          min-width: 0;
          padding: 23px;
          margin-bottom: 18px;
          border: 1px solid #292d25;
          border-radius: 14px;
          background: #121712;
        }

        .panel h2 {
          margin: 0 0 7px;
          color: #f0c45b;
          font-size: 17px;
        }

        .panel h3 {
          color: #e9e9df;
          font-size: 14px;
        }

        .wallet-box {
          padding: 20px;
          margin-top: 17px;
          border: 1px solid #4a3d20;
          border-radius: 12px;
          background: linear-gradient(130deg, #292316, #151810);
        }

        .wallet-balance {
          margin: 10px 0;
          color: #f3cf71;
          font-size: clamp(27px, 5vw, 37px);
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

        .form-label {
          display: block;
          margin: 17px 0 8px;
          color: #b8bdb3;
          font-size: 12px;
        }

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

        .field:focus {
          border-color: #d8ae4e;
        }

        .primary-btn {
          width: 100%;
          padding: 14px;
          margin-top: 14px;
          border: none;
          border-radius: 9px;
          color: #11130d;
          background: linear-gradient(135deg, #f3d47f, #c39636);
          font-weight: 900;
          transition: opacity .2s;
        }

        .primary-btn:hover {
          opacity: .9;
        }

        .primary-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .secondary-btn {
          width: 100%;
          padding: 13px;
          border: 1px solid #4b4230;
          border-radius: 9px;
          color: #f0c45b;
          background: #1c1b13;
        }

        .payment-box {
          margin-top: 20px;
          padding: 18px;
          border: 1px solid #4c4025;
          border-radius: 11px;
          background: #0b100c;
          overflow-wrap: anywhere;
        }

        .payment-amount {
          color: #7cde99;
          font-size: 25px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .address {
          padding: 13px;
          border: 1px solid #303a30;
          border-radius: 8px;
          background: #171e17;
          color: #e9e9df;
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .error {
          margin-top: 13px;
          color: #ff8585;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .success {
          color: #73db91;
          font-size: 12px;
        }

        .feature-card {
          padding: 18px;
          margin-top: 13px;
          border: 1px solid #30372e;
          border-radius: 11px;
          background: #171d17;
        }

        .feature-title {
          color: #e7c66e;
          font-weight: bold;
          font-size: 13px;
        }

        .feature-status {
          margin-top: 9px;
          color: #8e988c;
          font-size: 12px;
        }

        .footer {
          padding: 25px 10px;
          color: #687166;
          text-align: center;
          font-size: 11px;
        }

        .auth-wrap {
          min-height: calc(100vh - 76px);
          display: grid;
          place-items: center;
          padding: 25px;
        }

        .auth-card {
          width: 100%;
          max-width: 430px;
          padding: 30px;
          border: 1px solid #393322;
          border-radius: 17px;
          background: linear-gradient(145deg, #1a1d16, #101510);
          box-shadow: 0 20px 70px rgba(0,0,0,.3);
        }

        .auth-card h1 {
          color: #f0c45b;
          font-size: 27px;
        }

        .auth-switch {
          border: none;
          background: none;
          color: #f0c45b;
          font-weight: bold;
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .topbar {
            padding: 13px 16px;
          }

          .brand-name {
            font-size: 13px;
          }

          .brand-tagline {
            font-size: 10px;
          }

          .brand-icon {
            width: 37px;
            height: 37px;
          }

          .user-email {
            display: none;
          }

          .layout {
            display: block;
          }

          .sidebar {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding: 10px 12px;
            border-right: none;
            border-bottom: 1px solid #252a24;
          }

          .side-label {
            display: none;
          }

          .nav-link {
            flex: 0 0 auto;
            margin: 0;
            padding: 11px 13px;
            font-size: 11px;
          }

          .main-content {
            padding: 25px 15px;
          }

          .stat-card {
            padding: 16px;
          }

          .stat-value {
            font-size: 19px;
          }

          .panel {
            padding: 18px;
          }

          .auth-card {
            padding: 23px;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">₿</div>
          <div>
            <div className="brand-name">CRYPTO MINING HUB</div>
            <div className="brand-tagline">Mine Smart. Grow Digital.</div>
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

            <h1>
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>

            <p className="muted">
              {mode === "login"
                ? "Login to access your wallet and dashboard."
                : "Register your new Crypto Mining Hub account."}
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
                  ? "Please wait..."
                  : mode === "login" ? "LOGIN TO ACCOUNT" : "CREATE ACCOUNT"}
              </button>
            </form>

            {message && <p className="muted">{message}</p>}

            <p className="muted" style={{ marginTop: 22 }}>
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
              {" "}
              <button
                className="auth-switch"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setMessage("");
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
            <div className="side-label">MAIN MENU</div>
            <a className="nav-link active" href="#overview">▦ Dashboard</a>
            <a className="nav-link" href="#wallet">◈ My Wallet</a>
            <a className="nav-link" href="#deposit">＋ Deposit</a>
            <a className="nav-link" href="#withdraw">↗ Withdraw</a>
            <a className="nav-link" href="#mining">⛏ Mining Plans</a>
          </aside>

          <section className="main-content">
            <div className="welcome-row" id="overview">
              <div>
                <div className="eyebrow">ACCOUNT OVERVIEW</div>
                <h1 className="page-title">My Dashboard</h1>
                <p className="muted">
                  Welcome to Crypto Mining Hub. Manage your digital wallet.
                </p>
              </div>

              <div className="status-pill">
                <span className="status-dot"></span>
                ACCOUNT CONNECTED
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-label">Wallet Balance</div>
                <div className="stat-value">
                  {walletLoading ? "..." : `${money} USDT`}
                </div>
                <div className="stat-note">USDT · BEP20</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📥</div>
                <div className="stat-label">Total Deposits</div>
                <div className="stat-value">—</div>
                <div className="stat-note">History integration pending</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📤</div>
                <div className="stat-label">Withdrawals</div>
                <div className="stat-value">—</div>
                <div className="stat-note">Not available yet</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⛏️</div>
                <div className="stat-label">Mining Status</div>
                <div className="stat-value">Coming Soon</div>
                <div className="stat-note">Mining integration pending</div>
              </div>
            </div>

            {walletError && (
              <p className="error">Wallet error: {walletError}</p>
            )}

            <div className="content-grid">
              <div>
                <div className="panel" id="wallet">
                  <h2>My Wallet</h2>
                  <p className="muted">
                    Your digital wallet balance and network information.
                  </p>

                  <div className="wallet-box">
                    <div className="muted">AVAILABLE BALANCE</div>
                    <div className="wallet-balance">
                      {walletLoading ? "Loading..." : `${money} USDT`}
                    </div>
                    <span className="network-tag">● BNB Smart Chain · BEP20</span>
                  </div>

                  {!walletLoading && !wallet && !walletError && (
                    <p className="muted">
                      Wallet record not found. Your wallet will appear when
                      a wallet record is available.
                    </p>
                  )}
                </div>

                <div className="panel" id="deposit">
                  <h2>Deposit USDT</h2>
                  <p className="muted">
                    Add funds to your wallet using NOWPayments.
                  </p>

                  <div className="feature-card">
                    <div className="feature-title">SUPPORTED NETWORK</div>
                    <div className="feature-status">
                      BNB Smart Chain (BEP20) · Minimum deposit: $1 USD
                    </div>
                  </div>

                  <form onSubmit={handleDeposit}>
                    <label className="form-label">
                      Deposit Amount (USD)
                    </label>

                    <input
                      className="field"
                      type="number"
                      min="1"
                      max="10000"
                      step="0.01"
                      placeholder="Enter amount in USD"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      required
                    />

                    <button
                      className="primary-btn"
                      type="submit"
                      disabled={depositLoading}
                    >
                      {depositLoading
                        ? "CREATING PAYMENT..."
                        : "CREATE DEPOSIT"}
                    </button>
                  </form>

                  {depositError && (
                    <p className="error">{depositError}</p>
                  )}

                  {depositInfo && (
                    <div className="payment-box">
                      <h3 style={{ color: "#f0c45b" }}>
                        Payment Instructions
                      </h3>

                      <p className="muted">
                        Payment status: {depositInfo.payment_status || "Waiting"}
                      </p>

                      <p className="muted">Send exactly:</p>

                      <div className="payment-amount">
                        {depositInfo.pay_amount} {depositInfo.pay_currency}
                      </div>

                      <p className="muted">Network: BEP20 only</p>

                      <p className="form-label">Payment Address</p>

                      <div className="address">
                        {depositInfo.pay_address}
                      </div>

                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ marginTop: 12 }}
                        onClick={copyAddress}
                      >
                        COPY PAYMENT ADDRESS
                      </button>

                      {copyMessage && (
                        <p className="success">{copyMessage}</p>
                      )}

                      <p className="muted" style={{ color: "#e7c66e" }}>
                        Send only USDT on BEP20 to this address.
                        Your wallet balance will update after payment
                        verification.
                      </p>

                      <small className="muted">
                        Payment ID: {depositInfo.payment_id}
                      </small>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="panel" id="withdraw">
                  <h2>Withdrawals</h2>
                  <p className="muted">
                    Manage requests to withdraw funds from your wallet.
                  </p>

                  <div className="feature-card">
                    <div className="feature-title">WITHDRAWAL SERVICE</div>
                    <div className="feature-status">
                      Coming soon. Secure withdrawal requests and admin
                      approval are not yet connected.
                    </div>
                  </div>

                  <button className="secondary-btn" disabled
                    style={{ marginTop: 15, opacity: .5 }}>
                    WITHDRAWAL NOT AVAILABLE
                  </button>
                </div>

                <div className="panel" id="mining">
                  <h2>Mining Plans</h2>
                  <p className="muted">
                    Explore digital mining plans and account activity.
                  </p>

                  <div className="feature-card">
                    <div className="feature-title">MINING STATUS</div>
                    <div className="feature-status">
                      Not connected. Mining integration is coming soon.
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h2>Account Information</h2>
                  <p className="muted">Signed in as:</p>
                  <p style={{ overflowWrap: "anywhere" }}>{user.email}</p>
                  <div className="network-tag">● Supabase Account</div>
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
