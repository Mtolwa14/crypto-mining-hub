
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const plans = [
  { name: "STARTER", speed: 10, rate: 0.00001 },
  { name: "BASIC", speed: 25, rate: 0.000025 },
  { name: "PRO", speed: 50, rate: 0.00005 },
  { name: "PREMIUM", speed: 100, rate: 0.0001 },
];

export default function MiningPage() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState(false);
  const [plan, setPlan] = useState(plans[0]);
  const [seconds, setSeconds] = useState(0);
  const [reward, setReward] = useState(0);
  const [history, setHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const { data } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!data.user) {
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
          setWithdrawals(
            Array.isArray(parsed.withdrawals) ? parsed.withdrawals : []
          );
          setSeconds(Number(parsed.seconds || 0));
        } catch {
          localStorage.removeItem(key);
        }
      }

      setLoading(false);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active || !user) return;

    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
      setReward((value) => value + plan.rate);
    }, 1000);

    return () => clearInterval(timer);
  }, [active, user, plan]);

  useEffect(() => {
    if (!user) return;

    localStorage.setItem(
      `cmh_mining_${user.id}`,
      JSON.stringify({ reward, history, withdrawals, seconds })
    );
  }, [user, reward, history, withdrawals, seconds]);

  const pendingTotal = withdrawals
    .filter((item) => item.status === "Pending Review")
    .reduce((total, item) => total + Number(item.amount), 0);

  const availableBalance = Math.max(0, reward - pendingTotal);

  function startMining() {
    setMessage("");
    setActive(true);
  }

  function stopMining() {
    setActive(false);

    if (seconds > 0) {
      setHistory((items) => [
        {
          id: Date.now(),
          plan: plan.name,
          duration: seconds,
          date: new Date().toLocaleString(),
        },
        ...items,
      ]);
    }
  }

  function requestWithdrawal(event) {
    event.preventDefault();
    setMessage("");

    const amount = Number(withdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }

    if (amount > availableBalance) {
      setMessage("Insufficient available mining rewards.");
      return;
    }

    const request = {
      id: Date.now(),
      amount,
      status: "Pending Review",
      date: new Date().toLocaleString(),
    };

    setWithdrawals((items) => [request, ...items]);
    setWithdrawAmount("");
    setMessage("Withdrawal request submitted for simulator review.");
  }

  function formatTime(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  if (loading) {
    return <main className="loading">Loading Mining...</main>;
  }

  return (
    <main className="mining-page">
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #080b0a; color: #f4f4f4; font-family: Arial, sans-serif; }
        .mining-page { min-height: 100vh; padding: 22px; max-width: 1150px; margin: auto; }
        .top { display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap; }
        .brand { color: #e7bd55; font-size: 22px; font-weight: 900; }
        .back { color: #e7bd55; text-decoration: none; border: 1px solid #665329; padding: 10px 15px; border-radius: 9px; }
        .notice { margin: 24px 0; padding: 15px; border: 1px solid #80672d; background: #211b0d; border-radius: 12px; color: #f3d98d; line-height: 1.6; }
        .hero { margin: 28px 0; }
        .hero h1 { font-size: clamp(28px, 5vw, 42px); margin-bottom: 8px; }
        .muted { color: #9ca39f; line-height: 1.6; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
        .card { background: #111714; border: 1px solid #29342d; padding: 20px; border-radius: 15px; }
        .card small { color: #9ca39f; }
        .value { font-size: 25px; color: #e7bd55; font-weight: 800; margin-top: 12px; overflow-wrap: anywhere; }
        .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 18px 0 28px; }
        .plan { background: #111714; border: 1px solid #29342d; padding: 18px; border-radius: 14px; }
        .plan.selected { border: 2px solid #d9ad42; }
        .plan h3 { color: #e7bd55; }
        button { cursor: pointer; border: 0; border-radius: 9px; padding: 12px 16px; font-weight: 800; }
        .choose { background: #29342d; color: white; width: 100%; }
        .selected .choose { background: #d9ad42; color: #111; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
        .start { background: #20a36b; color: white; }
        .stop { background: #b94747; color: white; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .status { color: #36d58b; font-weight: bold; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 520px; }
        th, td { text-align: left; padding: 13px 10px; border-bottom: 1px solid #29342d; }
        th { color: #e7bd55; }
        input { width: 100%; background: #080b0a; color: white; border: 1px solid #46534a; padding: 14px; border-radius: 9px; margin: 10px 0; }
        .withdraw { background: #d9ad42; color: #111; width: 100%; }
        .pending { color: #f0c65d; font-weight: bold; }
        .message { margin-top: 12px; color: #f0c65d; line-height: 1.5; }
        .footer { text-align: center; color: #777; padding: 35px 0 15px; font-size: 13px; }
        .loading { color: white; padding: 50px; text-align: center; }
      `}</style>

      <header className="top">
        <div className="brand">₿ CRYPTO MINING HUB</div>
        <a className="back" href="/">← Back to Dashboard</a>
      </header>

      <div className="notice">
        <strong>MINING SIMULATOR</strong><br />
        Rewards na withdrawal requests ni za majaribio tu.
        Si cryptocurrency halisi, si uwekezaji na hakuna malipo
        halisi yatakayotumwa. Maombi yataonekana Pending Review.
      </div>

      <section className="hero">
        <h1>Mining Dashboard ⛏️</h1>
        <p className="muted">Manage your mining activity, rewards and withdrawal requests.</p>
      </section>

      <section className="stats">
        <div className="card">
          <small>Mining Status</small>
          <div className="value">{active ? "RUNNING" : "STOPPED"}</div>
          <p className={active ? "status" : "muted"}>
            {active ? "● Mining is active" : "● Mining is inactive"}
          </p>
        </div>
        <div className="card">
          <small>Mining Hashrate</small>
          <div className="value">{plan.speed} MH/s</div>
        </div>
        <div className="card">
          <small>Mining Time</small>
          <div className="value">{formatTime(seconds)}</div>
        </div>
        <div className="card">
          <small>Total Rewards</small>
          <div className="value">{reward.toFixed(8)}</div>
        </div>
        <div className="card">
          <small>Available Rewards</small>
          <div className="value">{availableBalance.toFixed(8)}</div>
        </div>
        <div className="card">
          <small>Pending Withdrawals</small>
          <div className="value">{pendingTotal.toFixed(8)}</div>
        </div>
      </section>

      <h2 style={{ marginTop: 35 }}>Mining Plans</h2>
      <p className="muted">Chagua kiwango cha mining unachotaka kutumia.</p>

      <section className="plans">
        {plans.map((item) => (
          <div className={`plan ${plan.name === item.name ? "selected" : ""}`} key={item.name}>
            <h3>{item.name}</h3>
            <div className="value">{item.speed} MH/s</div>
            <p className="muted">Mining speed</p>
            <p>Reward rate: {item.rate} units/sec</p>
            <button
              className="choose"
              disabled={active}
              onClick={() => setPlan(item)}
            >
              {plan.name === item.name ? "Selected" : "Select Plan"}
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Mining Control</h2>
        <p className="muted">Selected plan: {plan.name}</p>
        <div className="actions">
          <button className="start" onClick={startMining} disabled={active}>
            ▶ Start Mining
          </button>
          <button className="stop" onClick={stopMining} disabled={!active}>
            ■ Stop Mining
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Withdraw Mining Rewards</h2>
        <p className="muted">
          Available balance: <strong>{availableBalance.toFixed(8)}</strong>
        </p>
        <form onSubmit={requestWithdrawal}>
          <input
            type="number"
            min="0.00000001"
            step="0.00000001"
            placeholder="Enter withdrawal amount"
            value={withdrawAmount}
            onChange={(event) => setWithdrawAmount(event.target.value)}
            required
          />
          <button className="withdraw" type="submit">
            Request Withdrawal
          </button>
        </form>
        {message && <p className="message">{message}</p>}
        <p className="muted">
          Simulator requests only. No real payment is made.
        </p>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Withdrawal History</h2>
        {withdrawals.length === 0 ? (
          <p className="muted">No withdrawal requests yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{Number(item.amount).toFixed(8)}</td>
                    <td className="pending">{item.status}</td>
                    <td>{item.date}</td>
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
                <tr><th>Plan</th><th>Duration</th><th>Date</th></tr>
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
