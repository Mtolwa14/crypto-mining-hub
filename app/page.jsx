
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
        body: JSON.stringify({
          amount: Number(depositAmount)
        })
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
      setCopyMessage("Address copied!");
    } catch {
      setCopyMessage("Please copy the address manually.");
    }
  }

  const inputStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "14px",
    margin: "15px 0",
    borderRadius: "8px",
    border: "1px solid #45566c",
    background: "#07111f",
    color: "white"
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    background: "#e9b949",
    color: "#07111f",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer"
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#07111f",
      color: "white",
      padding: "25px",
      fontFamily: "Arial, sans-serif"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h2 style={{ color: "#e9b949" }}>
            ₿ CRYPTO MINING HUB
          </h2>
          <small>Mine Smart. Grow Digital.</small>
        </div>

        {user && (
          <button onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {!user ? (
        <section style={{
          maxWidth: "420px",
          margin: "65px auto",
          padding: "28px",
          background: "#122238",
          borderRadius: "16px"
        }}>
          <h1 style={{ color: "#e9b949" }}>
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h1>

          <p>
            {mode === "login"
              ? "Login to your Crypto Mining Hub account."
              : "Register your new account."}
          </p>

          <form onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Password (minimum 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={loading}
              style={buttonStyle}
            >
              {loading
                ? "Please wait..."
                : mode === "login" ? "Login" : "Register"}
            </button>
          </form>

          {message && (
            <p style={{ overflowWrap: "anywhere" }}>
              {message}
            </p>
          )}

          <p style={{ marginTop: "22px" }}>
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
            {" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#e9b949",
                cursor: "pointer"
              }}
            >
              {mode === "login" ? "Register" : "Login"}
            </button>
          </p>
        </section>
      ) : (
        <section style={{
          maxWidth: "650px",
          margin: "55px auto",
          padding: "28px",
          background: "#122238",
          borderRadius: "16px"
        }}>
          <h1 style={{ color: "#e9b949" }}>
            Welcome to Crypto Mining Hub!
          </h1>

          <p>Logged in as: {user.email}</p>

          <h2>My Dashboard</h2>

          <h3>My Wallet</h3>

          {walletLoading ? (
            <p>Loading wallet...</p>
          ) : walletError ? (
            <p>Wallet error: {walletError}</p>
          ) : wallet ? (
            <>
              <h2>
                {Number(wallet.balance).toFixed(2)} {wallet.currency}
              </h2>
              <p>Network: {wallet.network}</p>
            </>
          ) : (
            <p>Wallet record not found.</p>
          )}

          <hr />

          <h3>Deposit USDT</h3>
          <p>Network: BNB Smart Chain (BEP20)</p>
          <p>Minimum deposit: 1 USD</p>

          <form onSubmit={handleDeposit}>
            <input
              type="number"
              min="1"
              max="10000"
              step="0.01"
              placeholder="Enter amount in USD"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              required
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={depositLoading}
              style={buttonStyle}
            >
              {depositLoading
                ? "Creating payment..."
                : "Create Deposit"}
            </button>
          </form>

          {depositError && (
            <p style={{ color: "#ff8585", overflowWrap: "anywhere" }}>
              {depositError}
            </p>
          )}

          {depositInfo && (
            <div style={{
              marginTop: "22px",
              padding: "18px",
              background: "#07111f",
              borderRadius: "10px",
              overflowWrap: "anywhere"
            }}>
              <h3 style={{ color: "#e9b949" }}>
                Payment Instructions
              </h3>

              <p>Payment status: {depositInfo.payment_status || "Waiting"}</p>

              <p>Send exactly:</p>
              <h2>
                {depositInfo.pay_amount} {depositInfo.pay_currency}
              </h2>

              <p>Network: BEP20 only</p>

              <p>Payment address:</p>
              <p style={{
                padding: "12px",
                background: "#122238",
                borderRadius: "8px",
                overflowWrap: "anywhere"
              }}>
                {depositInfo.pay_address}
              </p>

              <button
                type="button"
                onClick={copyAddress}
                style={buttonStyle}
              >
                Copy Payment Address
              </button>

              {copyMessage && <p>{copyMessage}</p>}

              <p style={{ color: "#e9b949" }}>
                Send only USDT on BEP20 to this address.
                Your wallet balance will update after payment verification.
              </p>

              <small>
                Payment ID: {depositInfo.payment_id}
              </small>
            </div>
          )}

          <hr />

          <h3>Total Deposits</h3>
          <p>Not available yet</p>

          <h3>Withdrawals</h3>
          <p>Not available yet</p>

          <h3>Mining Status</h3>
          <p>Not connected</p>
          <p>Mining integration is coming soon.</p>
        </section>
      )}
    </main>
  );
}
