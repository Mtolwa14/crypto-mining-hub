
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const plans = [
  { name: "STARTER", price: 10, speed: 10, rate: 0.00001 },
  { name: "BASIC", price: 25, speed: 25, rate: 0.000025 },
  { name: "PRO", price: 50, speed: 50, rate: 0.00005 },
  { name: "PREMIUM", price: 100, speed: 100, rate: 0.0001 },
  { name: "GOLD", price: 250, speed: 250, rate: 0.00025 },
  { name: "PLATINUM", price: 500, speed: 500, rate: 0.0005 },
  { name: "DIAMOND", price: 1000, speed: 1000, rate: 0.001 },
  { name: "VIP", price: 2000, speed: 2000, rate: 0.002 },
];

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

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
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activePurchase = purchases.find(
    (item) => item.status === "active"
  );

  const activePlan = activePurchase
    ? plans.find((item) => item.name === activePurchase.plan_name)
    : null;

  const pendingTotal = withdrawals
    .filter((item) => item.status === "Pending Review")
    .reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

  const availableBalance = Math.max(0, reward - pendingTotal);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

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

    if (purchaseResult.error) {
      console.error("Purchase loading error:", purchaseResult.error);
    } else {
      setPurchases(purchaseResult.data || []);
    }

    if (withdrawalResult.error) {
      console.error("Withdrawal loading error:", withdrawalResult.error);
    } else {
      setWithdrawals(withdrawalResult.data || []);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
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
            setHistory(
              Array.isArray(parsed.history) ? parsed.history : []
            );
            setSeconds(Number(parsed.seconds || 0));
          } catch {
            localStorage.removeItem(key);
          }
        }

        await loadRecords();
      } catch (error) {
        console.error("Mining initialization error:", error);
        if (mounted) {
          showMessage(
            "Could not load your mining dashboard. Please refresh the page.",
            "error"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
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

    return [h, m, s]
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "-";
  }

  async function buyPlan(planToBuy) {
    if (busy) return;

    if (!planToBuy || !plans.some((p) => p.name === planToBuy.name)) {
      showMessage("Please select a valid plan.", "error");
      return;
    }

    setSelectedPlan(planToBuy);
    setBusy(true);
    setPayment(null);
    showMessage(
      `Preparing ${planToBuy.name} payment. Please wait...`,
      "info"
    );

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      showMessage(
        `Connecting to payment provider for ${planToBuy.name}...`,
        "info"
      );

      const response = await fetch("/api/plan-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_name: planToBuy.name,
        }),
      });

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        console.error("Invalid payment API response:", responseText);
        throw new Error(
          `Server returned an invalid response. HTTP ${response.status}. Please check the Vercel Runtime Logs.`
        );
      }

      if (!response.ok) {
        console.error("Payment API error:", result);

        const details = [
          result.error,
          result.details,
          result.provider_status
            ? `Provider status: ${result.provider_status}`
            : "",
        ]
          .filter(Boolean)
          .join(" — ");

        throw new Error(
          details || `Payment request failed. HTTP ${response.status}.`
        );
      }

      if (!result.payment_id) {
        console.error("Incomplete payment response:", result);
        throw new Error(
          "The payment provider did not return a payment ID. Please try again later."
        );
      }

      setPayment({
        ...result,
        plan: result.plan || planToBuy.name,
        price_usdt: result.price_usdt || planToBuy.price,
      });

      showMessage(
        `Payment created for ${planToBuy.name}. Follow the payment instructions below.`,
        "success"
      );

      await loadRecords();
    } catch (error) {
      console.error("BUY PLAN ERROR:", error);
      showMessage(
        error.message || "Payment request failed. Please try again.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (busy) return;

    setBusy(true);
    showMessage("Refreshing your records...", "info");

    try {
      await loadRecords();
      showMessage("Your plan and withdrawal records have been refreshed.", "success");
    } catch (error) {
      console.error("Refresh error:", error);
      showMessage("Could not refresh your records.", "error");
    } finally {
      setBusy(false);
    }
  }

  function startMining() {
    if (!activePlan) {
      showMessage(
        "You must have a payment-confirmed active plan before starting the simulator.",
        "error"
      );
      return;
    }

    setActive(true);
    showMessage("Mining simulator started.", "success");
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

    showMessage("Mining simulator stopped.", "info");
  }

  async function copyAddress() {
    if (!payment?.pay_address) return;

    try {
      await navigator.clipboard.writeText(payment.pay_address);
      showMessage("Payment address copied.", "success");
    } catch {
      showMessage(
        "Could not copy automatically. Please select and copy the address.",
        "error"
      );
    }
  }

  async function requestWithdrawal(event) {
    event.preventDefault();

    if (busy) return;

    const amount = Number(withdrawAmount);

    if (!activePurchase) {
      showMessage(
        "You must first have a payment-confirmed active plan.",
        "error"
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("Please enter a valid amount.", "error");
      return;
    }

    if (amount > availableBalance) {
      showMessage("Insufficient available simulator points.", "error");
      return;
    }

    if (walletAddress.trim().length < 20) {
      showMessage("Please enter your USDT BEP20 wallet address.", "error");
      return;
    }

    setBusy(true);
    showMessage("Submitting demonstration withdrawal request...", "info");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Please sign in again.");
      }

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

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Invalid server response. HTTP ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(result.error || "Withdrawal request failed.");
      }

      setWithdrawAmount("");
      setWalletAddress("");
      await loadRecords();

      showMessage(
        "Demonstration request saved. Status: Pending Review. No cryptocurrency payout is sent.",
        "success"
      );
    } catch (error) {
      console.error("Withdrawal error:", error);
      showMessage(
        error.message || "Withdrawal request failed.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="loading">
        Loading Crypto Mining Hub...
      </main>
    );
  }

  return (
    <main className="mining-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

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

        .hero {
          margin: 28px 0;
        }

        .hero h1 {
          font-size: clamp(28px, 5vw, 42px);
        }

        .muted {
          color: #9ca39f;
          line-height: 1.6;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }

        .card,
        .plan {
          background: #111714;
          border: 1px solid #29342d;
          padding: 20px;
          border-radius: 15px;
        }

        .card small {
          color: #9ca39f;
        }

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

        .plan {
          display: flex;
          flex-direction: column;
        }

        .plan.selected {
          border: 2px solid #d9ad42;
        }

        .plan h3 {
          color: #e7bd55;
        }

        button {
          cursor: pointer;
          border: 0;
          border-radius: 9px;
          padding: 12px 16px;
          font-weight: 800;
          font-size: 14px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .choose {
          background: #29342d;
          color: white;
          width: 100%;
          margin-top: auto;
        }

        .buy {
          background: #d9ad42;
          color: #111;
          width: 100%;
          margin-top: 10px;
          min-height: 46px;
          position: relative;
          z-index: 2;
          pointer-events: auto;
        }

        .refresh {
          background: #29342d;
          color: white;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }

        .start {
          background: #20a36b;
          color: white;
        }

        .stop {
          background: #b94747;
          color: white;
        }

        .status {
          color: #36d58b;
          font-weight: bold;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 520px;
        }

        th,
        td {
          text-align: left;
          padding: 13px 10px;
          border-bottom: 1px solid #29342d;
        }

        th {
          color: #e7bd55;
        }

        input {
          width: 100%;
          background: #080b0a;
          color: white;
          border: 1px solid #46534a;
          padding: 14px;
          border-radius: 9px;
          margin: 10px 0;
          font-size: 16px;
        }

        .withdraw {
          background: #d9ad42;
          color: #111;
          width: 100%;
        }

        .pending {
          color: #f0c65d;
          font-weight: bold;
        }

        .active-label {
          color: #36d58b;
          font-weight: bold;
        }

        .message {
          margin: 16px 0;
          padding: 14px;
          border: 1px solid #80672d;
          border-radius: 9px;
          background: #211b0d;
          color: #f0c65d;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .message.success {
          border-color: #237c52;
          background: #10271c;
          color: #70e5a8;
        }

        .message.error {
          border-color: #a33d3d;
          background: #2b1111;
          color: #ff9999;
        }

        .payment-box {
          margin-top: 20px;
          padding: 18px;
          border: 1px solid #80672d;
          border-radius: 12px;
          background: #211b0d;
          overflow-wrap: anywhere;
        }

        .payment-box p {
          line-height: 1.6;
        }

        .address {
          padding: 12px;
          background: #080b0a;
          border: 1px solid #665329;
          border-radius: 8px;
          overflow-wrap: anywhere;
          word-break: break-all;
        }

        .copy {
          margin-top: 10px;
          background: #d9ad42;
          color: #111;
        }

        .footer {
          text-align: center;
          color: #777;
          padding: 35px 0 15px;
          font-size: 13px;
        }

        .loading {
          color: white;
          padding: 50px;
          text-align: center;
        }

        @media (max-width: 600px) {
          .mining-page {
            padding: 15px;
          }

          .brand {
            font-size: 19px;
          }

          .card,
          .plan {
            padding: 16px;
          }
        }
      `}</style>

      <header className="top">
        <div className="brand">₿ CRYPTO MINING HUB</div>
        <a className="back" href="/">
          ← Back to Dashboard
        </a>
      </header>

      <div className="notice">
        <strong>IMPORTANT PLATFORM NOTICE</strong>
        <br />
        Mining rewards displayed here are simulated demonstration
        points. They are not real cryptocurrency, verified investment
        profits, or money available for payout.
        <br />
        Plan payments are processed through NOWPayments. A payment
        must be independently confirmed before a plan is activated.
        <br />
        Withdrawal requests on this simulator are demonstration
        records only. No actual cryptocurrency payout is sent.
      </div>

      <section className="hero">
        <h1>Mining Dashboard ⛏️</h1>
        <p className="muted">
          Manage your plan selection, simulator and request history.
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
            {activePlan ? `${money(activePlan.price)} plan` : "No active plan"}
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
        <h2>Investment Plan Options</h2>
        <button
          type="button"
          className="refresh"
          onClick={refreshStatus}
          disabled={busy}
        >
          ↻ Refresh Status
        </button>
      </div>

      <p className="muted">
        Available plan amounts are shown below. Payment network:
        USDT BEP20 only. Simulator points are not investment profits.
      </p>

      {message && (
        <div className={`message ${messageType}`} role="status" aria-live="polite">
          {message}
        </div>
      )}

      <section className="plans">
        {plans.map((item) => (
          <div
            className={`plan ${
              selectedPlan.name === item.name ? "selected" : ""
            }`}
            key={item.name}
          >
            <h3>{item.name}</h3>

            <div className="value">{money(item.price)} USDT</div>
            <p className="muted">Plan amount</p>
            <p>{item.speed} MH/s simulator speed</p>
            <p className="muted">
              Simulated rate: {item.rate} points/sec
            </p>

            <button
              type="button"
              className="choose"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSelectedPlan(item);
                setPayment(null);
                showMessage(`${item.name} selected.`, "info");
              }}
            >
              {selectedPlan.name === item.name ? "Selected" : "Select Plan"}
            </button>

            <button
              type="button"
              className="buy"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                buyPlan(item);
              }}
            >
              {busy && selectedPlan.name === item.name
                ? "Processing..."
                : `BUY ${item.name}`}
            </button>
          </div>
        ))}
      </section>

      {payment && (
        <section className="payment-box">
          <h2>Complete Plan Payment</h2>

          <p>
            <strong>Plan:</strong> {payment.plan}
          </p>

          <p>
            <strong>Plan Amount:</strong> {money(payment.price_usdt)} USDT
          </p>

          <p>
            <strong>Network:</strong> USDT BEP20 (BSC) only
          </p>

          <p>
            <strong>Payment Amount:</strong>{" "}
            {payment.pay_amount ?? payment.expected_pay_amount ?? "Not provided"}{" "}
            {payment.pay_currency || "USDT"}
          </p>

          <p>
            <strong>Payment Address:</strong>
          </p>

          {payment.pay_address ? (
            <>
              <div className="address">{payment.pay_address}</div>
              <button
                type="button"
                className="copy"
                onClick={copyAddress}
              >
                Copy Payment Address
              </button>
            </>
          ) : (
            <p className="pending">
              Payment address has not been returned. Contact support before
              sending any funds.
            </p>
          )}

          {payment.payment_url && (
            <p>
              <a
                href={payment.payment_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#e7bd55" }}
              >
                Open payment page
              </a>
            </p>
          )}

          <p>
            <strong>Payment ID:</strong> {payment.payment_id}
          </p>

          <p className="muted">
            Send only the requested currency on the specified network.
            Do not send funds if the address or network is missing or unclear.
            Your plan will only activate after payment confirmation.
          </p>
        </section>
      )}

      <section className="card" style={{ marginTop: 30 }}>
        <h2>Mining Simulator</h2>

        <p className="muted">
          This feature generates demonstration points only. It does not
          perform real cryptocurrency mining or generate cash returns.
        </p>

        <div className="actions">
          <button
            type="button"
            className="start"
            onClick={startMining}
            disabled={active || !activePlan}
          >
            ▶ Start Simulator
          </button>

          <button
            type="button"
            className="stop"
            onClick={stopMining}
            disabled={!active}
          >
            ■ Stop Simulator
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Withdrawal Request</h2>

        <p className="muted">
          Demonstration requests only. Withdrawal currency shown is USDT
          BEP20. No real payout is made.
        </p>

        <form onSubmit={requestWithdrawal}>
          <label>Amount</label>
          <input
            type="number"
            min="0"
            step="0.00000001"
            placeholder="Enter amount"
            value={withdrawAmount}
            onChange={(event) => setWithdrawAmount(event.target.value)}
          />

          <label>USDT BEP20 Wallet Address</label>
          <input
            type="text"
            placeholder="Enter your BEP20 wallet address"
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
          />

          <button
            type="submit"
            className="withdraw"
            disabled={busy}
          >
            {busy ? "Processing..." : "Submit Demonstration Request"}
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Plan Purchase History</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="4">No plan purchases yet.</td>
                </tr>
              ) : (
                purchases.map((item) => (
                  <tr key={item.id}>
                    <td>{item.plan_name}</td>
                    <td>{money(item.price_usdt)}</td>
                    <td
                      className={
                        item.status === "active" ? "active-label" : "pending"
                      }
                    >
                      {item.status}
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Withdrawal History</h2>

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
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan="4">No withdrawal requests yet.</td>
                </tr>
              ) : (
                withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{Number(item.amount || 0).toFixed(8)}</td>
                    <td>{item.network || "BEP20"}</td>
                    <td className="pending">{item.status}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Mining Session History</h2>

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
              {history.length === 0 ? (
                <tr>
                  <td colSpan="3">No simulator sessions yet.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.plan}</td>
                    <td>{formatTime(item.duration)}</td>
                    <td>{item.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} Crypto Mining Hub. All rights reserved.
      </footer>
    </main>
  );
}
