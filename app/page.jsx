
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const plans = [
  { name: "STARTER", speed: 10, rate: 0.00001, price: "FREE", description: "Kwa wanaoanza" },
  { name: "BASIC", speed: 25, rate: 0.000025, price: "DEMO", description: "Demo mining ya kawaida" },
  { name: "PRO", speed: 50, rate: 0.00005, price: "DEMO", description: "Demo mining ya juu" },
  { name: "PREMIUM", speed: 100, rate: 0.0001, price: "DEMO", description: "Demo mining ya kiwango cha juu" },
];

export default function MiningPage() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState(false);
  const [plan, setPlan] = useState(plans[0]);
  const [seconds, setSeconds] = useState(0);
  const [reward, setReward] = useState(0);
  const [history, setHistory] = useState([]);
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

      const key = `cmh_demo_mining_${data.user.id}`;
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
      `cmh_demo_mining_${user.id}`,
      JSON.stringify({ reward, history, seconds })
    );
  }, [user, reward, history, seconds]);

  function startMining() {
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
          reward: Number(reward).toFixed(8),
          date: new Date().toLocaleString(),
        },
        ...items,
      ]);
    }
  }

  function resetDemo() {
    if (!window.confirm("Una uhakika unataka kufuta demo mining history na rewards?")) return;

    setActive(false);
    setSeconds(0);
    setReward(0);
    setHistory([]);

    if (user) {
      localStorage.removeItem(`cmh_demo_mining_${user.id}`);
    }
  }

  function formatTime(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

  if (loading) {
    return <main className="loading">Loading Mining Simulator...</main>;
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
        .reset { background: #343b37; color: white; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .status { color: #36d58b; font-weight: bold; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 520px; }
        th, td { text-align: left; padding: 13px 10px; border-bottom: 1px solid #29342d; }
        th { color: #e7bd55; }
        .footer { text-align: center; color: #777; padding: 35px 0 15px; font-size: 13px; }
        .loading { color: white; padding: 50px; text-align: center; }
      `}</style>

      <header className="top">
        <div className="brand">₿ CRYPTO MINING HUB</div>
        <a className="back" href="/">← Back to Dashboard</a>
      </header>

      <div className="notice">
        <strong>DEMO SIMULATOR ONLY</strong><br />
        Mining speed na rewards zinazoonekana hapa ni za majaribio tu.
        Huu si uchimbaji halisi wa cryptocurrency, si uwekezaji, na rewards
        hizi si pesa halisi. Haziongezwi kwenye USDT wallet wala haziwezi
        kutolewa.
      </div>

      <section className="hero">
        <h1>Mining Simulator ⛏️</h1>
        <p className="muted">Chagua demo plan, anza simulator na ufuatilie muda pamoja na demo rewards.</p>
      </section>

      <section className="stats">
        <div className="card">
          <small>Mining Status</small>
          <div className="value">{active ? "RUNNING" : "STOPPED"}</div>
          <p className={active ? "status" : "muted"}>{active ? "● Simulator is active" : "● Simulator is inactive"}</p>
        </div>

        <div className="card">
          <small>Demo Hashrate</small>
          <div className="value">{plan.speed} MH/s</div>
          <p className="muted">Illustrative speed only</p>
        </div>

        <div className="card">
          <small>Demo Session Time</small>
          <div className="value">{formatTime(seconds)}</div>
          <p className="muted">Timer ya simulator</p>
        </div>

        <div className="card">
          <small>Total Demo Rewards</small>
          <div className="value">{reward.toFixed(8)}</div>
          <p className="muted">Demo units — not withdrawable</p>
        </div>
      </section>

      <h2 style={{ marginTop: 35 }}>Choose a Demo Plan</h2>
      <p className="muted">Mipango hii ni ya kujaribu interface pekee. Hakuna malipo au faida halisi.</p>

      <section className="plans">
        {plans.map((item) => (
          <div className={`plan ${plan.name === item.name ? "selected" : ""}`} key={item.name}>
            <h3>{item.name}</h3>
            <div className="value">{item.speed} MH/s</div>
            <p className="muted">{item.description}</p>
            <p>Demo rate: {item.rate} units/sec</p>
            <p><strong>{item.price}</strong></p>
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
        <p className="muted">Selected plan: <strong>{plan.name}</strong></p>
        <div className="actions">
          <button className="start" onClick={startMining} disabled={active}>
            ▶ Start Demo Mining
          </button>
          <button className="stop" onClick={stopMining} disabled={!active}>
            ■ Stop Mining
          </button>
          <button className="reset" onClick={resetDemo}>
            Reset Demo
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 25 }}>
        <h2>Demo Mining History</h2>
        {history.length === 0 ? (
          <p className="muted">Hakuna session bado. Bonyeza Start Demo Mining kuanza.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duration</th>
                  <th>Demo Reward</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.plan}</td>
                    <td>{formatTime(item.duration)}</td>
                    <td>{item.reward}</td>
                    <td>{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} Crypto Mining Hub. Demo simulator only.
      </footer>
    </main>
  );
}
