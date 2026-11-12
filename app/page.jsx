
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
          setMessage("Registration successful! Check your email to confirm your account.");
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
  }

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
          <h2 style={{ color: "#e9b949" }}>₿ CRYPTO MINING HUB</h2>
          <small>Mine Smart. Grow Digital.</small>
        </div>
        {user && <button onClick={handleLogout}>Logout</button>}
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
            <p style={{ overflowWrap: "anywhere" }}>{message}</p>
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
          <p>Wallet Balance: $0.00</p>
          <p>Total Deposits: $0.00</p>
          <p>Withdrawals: $0.00</p>
          <p>Mining Status: Not connected</p>
          <p>Mining integration is coming soon.</p>
        </section>
      )}
    </main>
  );
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
