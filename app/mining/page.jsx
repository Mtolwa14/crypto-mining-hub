
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const plans = [
  { name: "STARTER", price: 10, speed: 10, rate: 0.00001 },
  { name: "BASIC", price: 25, speed: 25, rate: 0.000025 },
  { name: "PRO", price: 50, speed: 50, rate: 0.00005 },
  { name: "PREMIUM", price: 100, speed: 100, rate: 0.0001 },
];

export default function MiningPage() {
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(plans[0]);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [reward, setReward] = useState(0);
  const [history, setHistory] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [payment, setPayment] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activePurchase = purchases.find(
    (item) => item.status === "active" && Number(item.price_usdt) >= 10
  );

  const activePlan = activePurchase
    ? plans.find((item) => item.name === activePurchase.plan_name)
    : null;

  const currentPlan = active && activePlan ? activePlan : selectedPlan;

  const pendingTotal = withdrawals
    .filter((item) => item.status === "Pending Review")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const availableBalance = Math.max(0, reward - pendingTotal);

  async function loadRecords() {
    const [purchaseResult, withdrawalResult] = await Promise.all([
      supabase
        .from("mining_plan_purchases")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("mining_withdrawals")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (!purchaseResult.error) {
      setPurchases(purchaseResult.data || []);
    }

    if (!withdrawalResult.error) {
      setWithdrawals(withdrawalResult.data || []);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data.user) {
        window.location.href = "/";
        return;
      }

      setUser(data.user);

      const key = `cmh_mining_${data.user.id}`;
      const saved = localStorage.getItem(key);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setReward(Number(parsed.reward || 0));
          setHistory(Array.isArray(parsed.history) ? parsed.history : []);
          setSeconds(Number(parsed.seconds || 0));
        } catch {
          localStorage.removeItem(key);
        }
      }

      await loadRecords();

      if (mounted) setLoading(false);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active || !user || !activePlan) return;

    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
      setReward((value) => value + activePlan.rate);
    }, 1000);

    return () => clearInterval(timer);
  }, [active, user, activePlan]);

  useEffect(() => {
    if (!user) return;

    localStorage.setItem(
      `cmh_mining_${user.id}`,
      JSON.stringify({ reward, history, seconds })
    );
  }, [user, reward, history, seconds]);

  function formatTime(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "-";
  }

  async function buyPlan() {
    setBusy(true);
    setMessage("");
    setPayment(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error("Please sign in again.");

      const response = await fetch("/api/plan-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_name: selectedPlan.name }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create payment.");
      }

      setPayment(result);
      setMessage("Payment instructions created. Complete your USDT BEP20 payment.");
      await loadRecords();
    } catch (error) {
      setMessage(error.message || "Payment request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    setBusy(true);
    setMessage("");

    await loadRecords();

    setBusy(false);
    setMessage("Plan and withdrawal status refreshed.");
  }

  function startMining() {
    if (!activePlan) {
      setMessage("Purchase and activate a mining plan before starting.");
      return;
    }

    setSelectedPlan(activePlan);
    setMessage("");
    setActive(true);
  }

  function stopMining() {
    setActive(false);

    if (seconds > 0 && activePlan) {
      setHistory((items) => [
        {
          id: Date.now(),
          plan: activePlan.name,
          duration: seconds,
          date: new Date().toLocaleString(),
        },
        ...items,
      ]);
    }
  }

  async function requestWithdrawal(event) {
    event.preventDefault();
    setMessage("");

    const amount = Number(withdrawAmount);

    if (!activePurchase) {
      setMessage("You must first activate a plan worth at least 10 USDT.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }

    if (amount > availableBalance) {
      setMessage("Insufficient available simulator rewards.");
      return;
    }

    if (walletAddress.trim().length < 20) {
      setMessage("Please enter your USDT BEP20 wallet address.");
      return;
    }

    setBusy(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error("Please sign in again.");

      const response = await fetch("/api/mining-withdrawal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          wallet_address: walletAddress.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Withdrawal request failed.");
      }

      setWithdrawAmount("");
      setWalletAddress("");
      await loadRecords();

      setMessage(
        "Simulator withdrawal request saved. Status: Pending Review."
      );
    } catch (error) {
      setMessage(error.message || "Withdrawal request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="loading">Loading Mining...</main>;
  }

  return (
    <main className="mining-page">
      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #080b0a;
          color: #f4f4f4;
          font-family: Arial, sans-serif;
        }
        .mining-page {
          min-height: 100vh;
          padding: 22px;
          max-width: 1150px;
          margin: auto;
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }
        .brand {
          color: #e7bd55;
          font-size: 22px;
          font-weight: 900;
        }
        .back {
          color: #e7bd55;
          text-decoration: none;
          border: 1px solid #665329;
          padding: 10px 15px;
          border-radius: 9px;
        }
        .notice {
          margin: 24px 0;
          padding: 16px;
          border: 1px solid #80672d;
          background: #211b0d;
          border-radius: 12px;
          color: #f3d98d;
          line-height: 1.7;
        }
        .hero { margin: 28px 0; }
        .hero h1 { font-size: clamp(28px, 5vw, 42px); }
        .muted { color: #9ca39f; line-height: 1.6; }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }
        .card, .plan {
          background: #111714;
          border: 1px solid #29342d;
          padding: 20px;
          border-radius: 15px;
        }
        .card small { color: #9ca39f; }
        .value {
          font-size: 25px;
          color: #e7bd55;
          font-weight: 800;
          margin-top: 12px;
          overflow-wrap: anywhere;
        }
        .plans {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin: 18px 0 28px;
        }
        .plan.selected { border: 2px solid #d9ad42; }
        .plan h3 { color: #e7bd55; }
        button {
          cursor: pointer;
          border: 0;
          border-radius: 9px;
          padding: 12px 16px;
          font-weight: 800;
        }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .choose { background: #29342d; color: white; width: 100%; }
        .buy { background: #d9ad42; color: #111; width: 100%; margin-top: 10px; }
        .refresh { background: #29342d; color: white; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
        .start { background: #20a36b; color: white; }
        .stop { background: #b94747; color: white; }
        .status { color: #36d58b; font-weight: bold; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 520px; }
        th, td {
          text-align: left;
          padding: 13px 10px;
          border-bottom: 1px solid #29342d;
        }
        th { color: #e7bd55; }
        input {
          width: 100%;
          background: #080b0a;
          color: white;
          border: 1px solid #46534a;
          padding: 14px;
          border-radius: 9px;
          margin: 10px 0;
        }
        .withdraw { background: #d9ad42; color: #111; width: 100%; }
        .pending { color: #f0c65d; font-weight: bold; }
        .active-label { color: #36d58b; font-weight: bold; }
        .message { margin-top: 12px; color: #f0c65d; line-height: 1.5; }
        .payment-box {
          margin-top: 20px;
          padding: 18px;
          border: 1px solid #80672d;
          border-radius: 12px;
          background: #211b0d;
          overflow-wrap: anywhere;
        }
        .payment-box p { line-height: 1.6; }
        .footer {
          text-align: center;
          color: #777;
          padding: 35px 0 15px;
          font-size: 13px;
        }
        .loading { color: white; padding: 50px; text-align: center; }
      `}</style>

      <header className="top">
        <div className="brand">₿ CRYPTO MINING HUB</div>
        <a className="back" href="/">← Back to Dashboard</a>
      </header>

      <div className="notice">
        <strong>MINING SIMULATOR NOTICE</strong>
        <br />
        Mining rewards displayed here are simulated demonstration points.
        They are not real cryptocurrency, are not investment returns, and
        cannot be paid out as real money. Plan payments, where enabled, are
        payments for access to this simulator and do not guarantee earnings.
        <br />
        Withdrawal requests are demonstration records only. No actual
        cryptocurrency payout will be sent.
      </div>

      <section className="hero">
        <h1>Mining Dashboard ⛏️</h1>
        <p className="muted">
          Manage your simulator, plan access and request history.
        </p>
      </section>

      <section className="stats">
        <div className="card">
          <small>Mining Status</small>
          <div className="value">{active ? "RUNNING" : "STOPPED"}</div>
          <p className={active ? "status" : "muted"}>
            {active ? "● Simulator is running" : "● Simulator is inactive"}
          </p>
        </div>

        <div className="card">
          <small>Active Plan</small>
          <div className="value">{activePlan?.name || "NONE"}</div>
          <p className="muted">
            {activePlan ? `${activePlan.price} USDT plan` : "No active plan"}
          </p>
        </div>

        <div className="card">
          <small>Mining Speed</small>
          <div className="value">{activePlan?.speed || 0} MH/s</div>
        </div>

        <div className="card">
          <small>Mining Time</small>
          <div className="value">{formatTime(seconds)}</div>
        </div>

        <div className="card">
          <small>Total Simulated Rewards</small>
          <div className="value">{reward.toFixed(8)}</div>
        </div>

        <div className="card">
          <small>Available Simulator Points</small>
          <div className="value">{availableBalance.toFixed(8)}</div>
        </div>

        <div className="card">
          <small>Pending Requests</small>
          <div className="value">{pendingTotal.toFixed(8)}</div>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 35,
        }}
      >
        <h2>Mining Plans</h2>
        <button className="refresh" onClick={refreshStatus} disabled={busy}>
          ↻ Refresh Status
        </button>
      </div>

      <p className="muted">
        Select a simulator access plan. Plan payment is USDT BEP20 only.
      </p>

      <section className="plans">
        {plans.map((item) => (
          <div
            className={`plan ${
              selectedPlan.name === item.name ? "selected" : ""
            }`}
            key={item.name}
          >
            <h3>{item.name}</h3>
            <div className="value">{item.price} USDT</div>
            <p className="muted">Plan access price</p>
            <p>{item.speed} MH/s simulator speed</p>
            <p className="muted">
              Simulated rate: {item.rate} points/sec
            </p>

            <button
              className="choose"
              disabled={active || busy}
              onClick={() => {
                setSelectedPlan(item);
                setPayment(null);
                setMessage("");
              }}
            >
              {selectedPlan.name === item.name ? "Selected" : "Select Plan"}
            </button>

            <button
              className="buy"
              disabled={busy || active}
              onClick={buyPlan}
            >
              {busy && selectedPlan.name === item.name
                ? "Processing..."
                : "BUY PLAN"}
            </button>
          </div>
        ))}
      </section>

      {activePlan && (
        <section className="card">
          <h2>Your Activated Plan</h2>
          <p className="active-label">
            ✓ {activePlan.name} — ACTIVE
          </p>
          <p className="muted">
            Payment confirmation received. Simulator access is enabled.
          </p>
        </section>
      )}

      {payment && (
        <section className="payment-box">
          <h2>Complete Plan Payment</h2>
          <p>
            <strong>Network:</strong> USDT BEP20 (BSC) only
          </p>
          <p>
            <strong>Amount:</strong>{" "}
            {payment.pay_amount ?? payment.expected_pay_amount ?? "Check payment instructions"}{" "}
            {payment.pay_currency || "USDT"}
          </p>
          <p>
            <strong>Payment address:</strong>
            <br />
            {payment.pay_address || "Payment address not returned"}
          </p>
          <p>
            <strong>Order ID:</strong> {payment.order_id || "-"}
          </p>
          <p className="muted">
            Send only the exact amount to the displayed address on the
            specified network. Do not send another coin or network.
            Your plan will become active only after payment confirmation.
          </p>
        </section>
      )}

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Mining Control</h2>
        <p className="muted">
          {activePlan
            ? `Activated plan: ${activePlan.name}`
            : "Purchase and activate a plan before starting the simulator."}
        </p>

        <div className="actions">
          <button
            className="start"
            onClick={startMining}
            disabled={active || !activePlan}
          >
            ▶ Start Mining
          </button>

          <button className="stop" onClick={stopMining} disabled={!active}>
            ■ Stop Mining
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Request Withdrawal</h2>
        <p className="muted">
          An activated plan worth at least 10 USDT is required to submit a
          simulator withdrawal request.
        </p>
        <p className="muted">
          Available simulator points:{" "}
          <strong>{availableBalance.toFixed(8)}</strong>
        </p>

        <form onSubmit={requestWithdrawal}>
          <input
            type="number"
            min="0.00000001"
            step="0.00000001"
            placeholder="Enter simulator points amount"
            value={withdrawAmount}
            onChange={(event) => setWithdrawAmount(event.target.value)}
            required
          />

          <input
            type="text"
            placeholder="USDT BEP20 wallet address"
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            required
          />

          <p className="muted">
            Network: USDT BEP20 only. This creates a Pending Review
            demonstration record; it does not send cryptocurrency.
          </p>

          <button className="withdraw" type="submit" disabled={busy}>
            {busy ? "Submitting..." : "Submit Request"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Withdrawal History</h2>

        {withdrawals.length === 0 ? (
          <p className="muted">No withdrawal requests yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Network</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{Number(item.amount).toFixed(8)}</td>
                    <td>{item.network}</td>
                    <td className="pending">{item.status}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Mining History</h2>

        {history.length === 0 ? (
          <p className="muted">No mining sessions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duration</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.plan}</td>
                    <td>{formatTime(item.duration)}</td>
                    <td>{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} Crypto Mining Hub. All rights reserved.
      </footer>
    </main>
  );
}
