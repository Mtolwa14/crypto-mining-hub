
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

const LOCK_DAYS = 199;

const nav = [
  ["overview", "⌂", "Dashboard"],
  ["referral", "♧", "Referrals"],
  ["investments", "▣", "My Investments"],
  ["plans", "◇", "Mining Plans"],
  ["deposit", "↓", "Deposit"],
  ["wallet", "◉", "My Wallet"],
  ["deposits", "↙", "Deposit History"],
  ["withdrawals", "↗", "Withdrawals"],
  ["profit", "％", "Earnings"],
  ["account", "⚙", "Account"],
];

const money = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateText = (v) => (v ? new Date(v).toLocaleString() : "—");

const statusClass = (s) => {
  const status = String(s || "").toLowerCase();
  if (["approved", "active", "finished", "paid", "posted", "completed"].includes(status)) return "ok";
  if (["pending", "waiting", "confirming", "pending review"].includes(status)) return "pending";
  return "other";
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [signupReferralCode, setSignupReferralCode] = useState("");
  const [accountReferralCode, setAccountReferralCode] = useState("");
  const [referralApplyBusy, setReferralApplyBusy] = useState(false);
  const [referralApplyMsg, setReferralApplyMsg] = useState("");
  const [referralAlreadyLinked, setReferralAlreadyLinked] = useState(false);

  const [section, setSection] = useState("overview");
  const [wallet, setWallet] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [profits, setProfits] = useState([]);

  const [referralData, setReferralData] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [depositAmount, setDepositAmount] = useState("20");
  const [payment, setPayment] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("10");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawError, setWithdrawError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");

    if (code) {
      setSignupReferralCode(code.trim().toUpperCase());
      setMode("register");
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user || null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setLoadError("");

    try {
      const [w, d, p, wr, pr] = await Promise.all([
        supabase.from("wallets")
          .select("balance,currency,network")
          .eq("user_id", user.id)
          .eq("currency", "USDT")
          .eq("network", "BEP20")
          .maybeSingle(),

        supabase.from("transactions")
          .select("id,type,amount,currency,network,status,price_amount,actually_paid,created_at,provider_payment_id")
          .eq("user_id", user.id)
          .eq("type", "deposit")
          .order("created_at", { ascending: false })
          .limit(50),

        supabase.from("mining_plan_purchases")
          .select("id,plan_name,status,principal_usdt,price_usdt,created_at,activated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),

        supabase.from("mining_withdrawals")
          .select("id,amount,currency,network,wallet_address,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),

        supabase.from("investment_profit_allocations")
          .select("id,period_name,source,plan_name,principal_usdt,profit_usdt,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const errors = [w.error, d.error, p.error, wr.error, pr.error]
        .filter(Boolean)
        .map((e) => e.message);

      setWallet(w.error ? null : w.data);
      setDeposits(d.error ? [] : d.data || []);
      setPurchases(p.error ? [] : p.data || []);
      setWithdrawals(wr.error ? [] : wr.data || []);
      setProfits(pr.error ? [] : pr.data || []);

      if (errors.length) setLoadError(errors.join(" • "));
    } catch (err) {
      setLoadError(err.message || "Could not load account data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
    else {
      setWallet(null);
      setDeposits([]);
      setPurchases([]);
      setWithdrawals([]);
      setProfits([]);
    }
  }, [user, loadData]);

  async function authSubmit(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg("");

    try {
      if (mode === "register") {
        const referralCode = signupReferralCode.trim().toUpperCase();

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: referralCode ? { referral_code: referralCode } : {},
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
    setReferralData(null);
    setReferralAlreadyLinked(false);
  }

  async function getToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("Session expired. Please login again.");
    }
    return data.session.access_token;
  }

  async function createDeposit(e) {
    e.preventDefault();
    setBusyAction("deposit");
    setActionMsg("");
    setPayment(null);

    try {
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid deposit amount.");
      }

      const access = await getToken();
      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ amount }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || "Deposit creation failed.");
      }

      setPayment({ ...result, kind: "deposit", amount });
      setActionMsg("Payment instructions created. Send only the amount displayed below.");
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
        body: JSON.stringify({ plan_name: plan.name }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || "Plan payment could not be created.");
      }

      setPayment({
        ...result,
        kind: "plan",
        amount: plan.price,
        planName: plan.name,
      });

      setActionMsg("Payment instructions created. Complete payment to activate your plan.");
    } catch (err) {
      setActionMsg(err.message || "Plan purchase failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function submitWithdrawal(e) {
    e.preventDefault();
    setBusyAction("withdraw");
    setWithdrawMsg("");
    setWithdrawError("");

    try {
      const amount = Number(withdrawAmount);
      const balance = Number(wallet?.balance || 0);
      const address = withdrawAddress.trim();

      if (!Number.isFinite(amount) || amount < 10) {
        throw new Error("Minimum withdrawal is 10 USDT.");
      }
      if (balance < 10 || amount > balance) {
        throw new Error("Insufficient available wallet balance.");
      }
      if (address.length < 20 || address.length > 150) {
        throw new Error("Enter a valid USDT BEP20 wallet address.");
      }

      const access = await getToken();
      const response = await fetch("/api/mining-withdrawal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ amount, wallet_address: address }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Withdrawal request failed.");

      setWithdrawMsg(result.message || "Withdrawal request submitted for review.");
      setWithdrawOpen(false);
      setWithdrawAmount("10");
      setWithdrawAddress("");
      await loadData();
    } catch (err) {
      setWithdrawError(err.message || "Withdrawal request failed.");
    } finally {
      setBusyAction("");
    }
  }

  const approvedDeposits = useMemo(
    () => deposits.filter((x) =>
      ["approved", "finished"].includes(String(x.status || "").toLowerCase())
    ),
    [deposits]
  );

  const depositTotal = approvedDeposits.reduce(
    (sum, x) => sum + Number(x.actually_paid || x.amount || 0), 0
  );

  const activePlans = purchases.filter(
    (x) => String(x.status).toLowerCase() === "active"
  );

  const activeAmount = activePlans.reduce(
    (sum, x) => sum + Number(x.principal_usdt || x.price_usdt || 0), 0
  );

  const totalProfit = profits.reduce(
    (sum, x) => sum + Number(x.profit_usdt || 0), 0
  );

  const totalWithdrawn = withdrawals
    .filter((x) => ["approved", "paid", "completed"].includes(String(x.status || "").toLowerCase()))
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  async function loadReferralData() {
    if (!user) return;

    setReferralLoading(true);
    setReferralError("");

    try {
      const [dashboard, profile] = await Promise.all([
        supabase.rpc("get_my_referral_dashboard"),
        supabase.from("referral_profiles")
          .select("referred_by")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (dashboard.error) throw dashboard.error;
      setReferralData(dashboard.data || null);

      if (!profile.error) {
        setReferralAlreadyLinked(Boolean(profile.data?.referred_by));
      }
    } catch (err) {
      setReferralError(err.message || "Could not load referral details.");
      setReferralData(null);
    } finally {
      setReferralLoading(false);
    }
  }

  async function applyReferralCode(e) {
    e.preventDefault();
    setReferralApplyBusy(true);
    setReferralApplyMsg("");

    try {
      const code = accountReferralCode.trim().toUpperCase();
      if (!code) throw new Error("Enter a referral code.");
      if (referralAlreadyLinked) {
        throw new Error("A referral code has already been applied to this account.");
      }

      const { data, error } = await supabase.rpc("set_my_referrer", {
        p_code: code,
      });

      if (error) throw error;

      setReferralAlreadyLinked(true);
      setAccountReferralCode("");
      setReferralApplyMsg(
        typeof data === "string" ? data : "Referral code applied successfully."
      );
      await loadReferralData();
    } catch (err) {
      setReferralApplyMsg(err.message || "Could not apply referral code.");
    } finally {
      setReferralApplyBusy(false);
    }
  }

  async function shareInvite() {
    const code = referralData?.referral_code;
    if (!code) {
      setReferralError("Your referral code is not available yet.");
      return;
    }

    const inviteUrl = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    const shareText = `Join Crypto Mining Hub using my referral code: ${code}\n${inviteUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Crypto Mining Hub Invitation",
          text: shareText,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setActionMsg("Invite link copied successfully.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareText);
          setActionMsg("Invite link copied successfully.");
        } catch {
          setReferralError("Could not share or copy the invite link.");
        }
      }
    }
  }

  function go(id) {
    setSection(id);
    if (id === "referral" || id === "account") loadReferralData();
    setPayment(null);
    setActionMsg("");

    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function copyAddress(value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setActionMsg("Copied successfully.");
    } catch {
      setActionMsg("Copy failed. Please copy the text manually.");
    }
  }

  function paymentDetails(pay, title) {
    if (!pay) return null;
    return (
      <div className="paybox">
        <h3>{title}</h3>
        <p className="muted">Send USDT using BNB Smart Chain (BEP20).</p>
        <div className="label">Amount to Send</div>
        <div className="payvalue">{pay.pay_amount} {pay.pay_currency || "USDT"}</div>
        <div className="label">Payment Address</div>
        <div className="payvalue">{pay.pay_address || "Address not returned"}</div>
        {pay.payment_id && <p className="detail">Payment ID: {pay.payment_id}</p>}
        {pay.order_id && <p className="detail">Order ID: {pay.order_id}</p>}
        <button className="copybtn" type="button" onClick={() => copyAddress(pay.pay_address)}>
          COPY ADDRESS
        </button>
        <p className="smallnote">Confirm the address, amount and network before sending. The plan activates after payment confirmation.</p>
      </div>
    );
  }

  function referralPanel() {
    return (
      <div className="panel referral-panel" id="referral">
        <div className="panelhead">
          <div>
            <div className="eyebrow">INVITE & EARN</div>
            <h2>Referral Programme</h2>
            <p className="muted">Invite friends and earn commissions when their Mining Plans are confirmed.</p>
          </div>
          <button className="secondary" type="button" onClick={loadReferralData} disabled={referralLoading}>
            {referralLoading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        {referralError && <p className="error">{referralError}</p>}

        {referralLoading && !referralData ? (
          <div className="empty">Loading referral details...</div>
        ) : referralData ? (
          <>
            <div className="walletbox">
              <div className="muted">YOUR REFERRAL CODE</div>
              <div className="balance">{referralData.referral_code || "Not available"}</div>
              <button className="copybtn" type="button" onClick={() => copyAddress(referralData.referral_code)}>COPY CODE</button>
              <button className="primary" type="button" onClick={shareInvite}>SHARE INVITE</button>
              <p className="smallnote">Share your invite link. New users can register using your referral code.</p>
            </div>

            <div className="stats referral-stats">
              <div className="stat">
                <div className="statlabel">People Referred</div>
                <span className="statvalue">{referralData.referrals_count || 0}</span>
              </div>
              <div className="stat">
                <div className="statlabel">Total Commission</div>
                <span className="statvalue">{money(referralData.total_commission)} USDT</span>
              </div>
            </div>

            <h3>Commission Levels</h3>
            <div className="list">
              {[{ level: 1, rate: 10 }, { level: 2, rate: 3 }, { level: 3, rate: 2 }].map((x) => {
                const row = (referralData.level_totals || []).find((v) => Number(v.level) === x.level);
                return (
                  <div className="item" key={x.level}>
                    <div className="itemtop">
                      <span className="itemamount">Level {x.level} · {x.rate}%</span>
                      <span className="badge ok">{money(row?.total)} USDT</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{ marginTop: 18 }}>Commission History</h3>
            {(referralData.commissions || []).length === 0 ? (
              <div className="empty">No referral commissions yet. Commissions appear after a referred user's Mining Plan payment is confirmed.</div>
            ) : (
              <div className="list">
                {referralData.commissions.map((c) => (
                  <div className="item" key={c.id}>
                    <div className="itemtop">
                      <span className="itemamount">+{money(c.commission_amount)} USDT</span>
                      <span className={`badge ${statusClass(c.status)}`}>{c.status || "pending"}</span>
                    </div>
                    <div className="detail">Level {c.level} · Rate {c.commission_rate}% · Plan amount {money(c.base_amount)} USDT</div>
                    <div className="detail">Date: {dateText(c.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="smallnote">Commissions: Level 1 = 10%, Level 2 = 3%, Level 3 = 2%. Paid only after confirmed Mining Plan purchases. Deposits do not earn referral commission.</p>
          </>
        ) : (
          <div className="empty">Referral details are not available yet. Tap Refresh to try again.</div>
        )}
      </div>
    );
  }

  function miningPlansPanel() {
    return (
      <div className="plans-page" id="plans">
        <div className="plans-hero">
          <div className="eyebrow">CRYPTO MINING HUB · INVESTMENT PLANS</div>
          <h1 className="h1">Choose Your Mining Plan</h1>
          <p className="muted">
            Select a plan that matches your budget. Payments are made using USDT on BNB Smart Chain (BEP20).
          </p>
          <div className="plan-rules">
            <div>
              <span className="rule-icon">◈</span>
              <div>
                <strong>{LOCK_DAYS} DAYS</strong>
                <small>Principal lock period</small>
              </div>
            </div>
            <div>
              <span className="rule-icon">％</span>
              <div>
                <strong>Daily profit rate</strong>
                <small>Displayed after rates are configured and verified</small>
              </div>
            </div>
            <div>
              <span className="rule-icon">$</span>
              <div>
                <strong>$10 USDT</strong>
                <small>Minimum profit withdrawal target</small>
              </div>
            </div>
          </div>
        </div>

        {actionMsg && <p className="error">{actionMsg}</p>}

        <div className="plans-grid">
          {plans.map((plan, index) => (
            <div className={`plan-card plan-card-${index + 1}`} key={plan.name}>
              <div className="plan-card-top">
                <div className="planname">{plan.name}</div>
                {index === 7 && <span className="vip-tag">VIP</span>}
              </div>

              <div className="price">${plan.price.toLocaleString("en-US")}</div>
              <div className="planhint">USDT · BEP20</div>

              <div className="plan-details">
                <div className="plan-detail-row">
                  <span>Daily profit rate</span>
                  <strong className="rate-pending">Not configured</strong>
                </div>
                <div className="plan-detail-row">
                  <span>Estimated daily profit</span>
                  <strong>— USDT</strong>
                </div>
                <div className="plan-detail-row">
                  <span>Principal lock</span>
                  <strong>{LOCK_DAYS} days</strong>
                </div>
                <div className="plan-detail-row">
                  <span>Payment network</span>
                  <strong>USDT BEP20</strong>
                </div>
              </div>

              <button
                className="primary invest-button"
                onClick={() => buyPlan(plan)}
                disabled={!!busyAction}
              >
                {busyAction === plan.name
                  ? "CREATING PAYMENT..."
                  : "INVEST NOW"}
              </button>

              {payment?.kind === "plan" &&
                payment?.planName === plan.name &&
                paymentDetails(payment, `${plan.name} PAYMENT DETAILS`)}
            </div>
          ))}
        </div>

        <div className="plans-disclaimer">
          <strong>Important information</strong>
          <p>
            Daily profit rates and daily profit amounts are not configured yet.
            No fixed return is promised or guaranteed. Actual profit, if any,
            must be based on verifiable platform revenue and recorded allocations.
            The 199-day lock period is displayed as the plan term.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="cmh">
      <style jsx global>{`
        *{box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{margin:0;background:#090b10;color:#f5f3ed;font-family:Inter,Arial,sans-serif}
        button,input{font:inherit}
        button{cursor:pointer;transition:all .2s ease}
        button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
        .cmh{min-height:100vh;background:#090b10;color:#f5f3ed}
        .top{height:78px;position:sticky;top:0;z-index:30;background:#0d1017;border-bottom:1px solid #29251b;padding:12px 28px;display:flex;justify-content:space-between;align-items:center;gap:14px}
        .brand{display:flex;gap:12px;align-items:center}
        .logo{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#f8df9b,#b9872d);color:#111;font-weight:950;font-size:23px}
        .brand-title{font-weight:900;color:#f3d58c;letter-spacing:1.5px;font-size:14px}
        .tagline{font-size:10px;color:#858b98;margin-top:4px}
        .topright{display:flex;gap:12px;align-items:center}
        .email{font-size:11px;color:#b7bdc7;max-width:220px;overflow-wrap:anywhere}
        .logout,.secondary{padding:10px 14px;border:1px solid #554522;border-radius:10px;color:#f0d38a;background:#17191f}
        .layout{display:grid;grid-template-columns:250px minmax(0,1fr);max-width:1800px;margin:auto;min-height:calc(100vh - 78px)}
        .side{position:sticky;top:78px;height:calc(100vh - 78px);overflow-y:auto;padding:26px 15px;border-right:1px solid #242630;background:#0d1017}
        .side-caption{font-size:10px;color:#b9974e;letter-spacing:2px;margin:8px 12px 18px;font-weight:900}
        .navbtn{width:100%;display:flex;text-align:left;gap:13px;align-items:center;padding:13px 14px;border:1px solid transparent;border-radius:11px;background:transparent;color:#9da3ae;font-size:12px;margin:5px 0}
        .navicon{width:22px;text-align:center;font-size:17px;color:#c6a45b}
        .navbtn.active{background:linear-gradient(100deg,#3a2e18,#201d17);border-color:#70582c;color:#f5d98f;box-shadow:inset 3px 0 #d3ad5d}
        .main{padding:30px clamp(16px,3vw,42px);min-width:0;max-width:1500px;width:100%;margin:0 auto}
        .welcome{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:22px;padding:27px 28px;border:1px solid #39301f;border-radius:19px;background:radial-gradient(ellipse at 88% 20%,#54401b55,transparent 35%),linear-gradient(115deg,#191b20,#171710 85%);position:relative;overflow:hidden}
        .welcome:after{content:"₿";position:absolute;right:8%;top:-25px;font-size:145px;font-weight:900;color:#d7b35d0b;pointer-events:none}
        .eyebrow{font-size:10px;letter-spacing:2px;color:#d7b65f;font-weight:900}
        .h1{font-size:clamp(25px,4vw,35px);margin:9px 0;color:#fff;font-weight:850;letter-spacing:-.6px}
        .muted{font-size:12px;color:#9ca3af;line-height:1.7}
        .connected{border:1px solid #315a43;background:#12271c;color:#8cdaa9;border-radius:30px;padding:9px 13px;font-size:10px;font-weight:bold;z-index:1}
        .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
        .stat,.panel,.plan,.chart-panel,.power-card{background:linear-gradient(145deg,#171a21,#111319);border:1px solid #292c33;border-radius:16px;box-shadow:0 12px 30px #0003}
        .stat{padding:19px;min-width:0;position:relative;overflow:hidden}
        .stat:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(#f0d58c,#99702b)}
        .statlabel{color:#a7adb7;font-size:11px}
        .statvalue{display:block;margin-top:10px;color:#f0d58c;font-weight:900;font-size:clamp(16px,2vw,23px);overflow-wrap:anywhere}
        .statnote{margin-top:7px;font-size:10px;color:#818894}
        .columns{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.85fr);gap:18px;align-items:start}
        .panel{padding:21px;margin-bottom:18px;min-width:0;scroll-margin-top:96px}
        .panel h2{font-size:16px;color:#f0d58c;margin:0 0 7px}
        .panel h3{font-size:13px;color:#e9edf3;margin:0 0 8px}
        .panelhead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
        .walletbox{margin-top:13px;padding:22px;border:1px solid #80632e;border-radius:14px;background:linear-gradient(135deg,#282315,#191a17)}
        .balance{font-size:clamp(25px,5vw,35px);font-weight:900;color:#f3d98e;margin:10px 0;overflow-wrap:anywhere}
        .network{display:inline-block;padding:7px 10px;border-radius:8px;color:#c5ac70;background:#282316;border:1px solid #554522;font-size:10px}
        .label{display:block;margin:14px 0 7px;color:#d4dbe4;font-size:11px}
        .field{display:block;width:100%;padding:13px;border:1px solid #3b404b;border-radius:10px;outline:none;background:#0c0e13;color:white}
        .field:focus{border-color:#d0ad58;box-shadow:0 0 0 3px #c9a34a20}
        .primary{display:block;width:100%;padding:13px;margin-top:12px;border:1px solid #e4c36e;border-radius:10px;color:#171717;background:linear-gradient(135deg,#f0d58c,#bd9138);font-weight:900}
        .primary:disabled{opacity:.45;cursor:not-allowed}
        .list{display:grid;gap:10px;margin-top:13px}
        .item{padding:14px;border:1px solid #30343c;border-radius:12px;background:#15181f;min-width:0}
        .itemtop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
        .itemamount{color:#f0d58c;font-size:14px;font-weight:800;overflow-wrap:anywhere}
        .detail{margin-top:7px;color:#9da4ae;font-size:10px;line-height:1.7;overflow-wrap:anywhere}
        .badge{display:inline-block;padding:6px 9px;border-radius:20px;font-size:10px;font-weight:bold}
        .badge.ok{color:#9ce4c5;background:#123326;border:1px solid #286b56}
        .badge.pending{color:#f0d58c;background:#332a17;border:1px solid #79602e}
        .badge.other{color:#c0cad5;background:#252a34;border:1px solid #404958}
        .empty{border:1px dashed #414650;border-radius:10px;padding:22px;text-align:center;color:#a0adbb;font-size:11px}
        .message{font-size:12px;color:#9ce4c5;margin-top:10px;overflow-wrap:anywhere}
        .error{font-size:12px;color:#ff9292;margin-top:10px;overflow-wrap:anywhere}
        .paybox{border:1px solid #80632e;background:#211d13;border-radius:12px;padding:14px;margin-top:14px;overflow-wrap:anywhere}
        .payvalue{word-break:break-all;background:#0c0e13;padding:10px;border-radius:7px;margin-top:7px;font-size:11px;color:#e9edf3}
        .copybtn{border:1px solid #554522;border-radius:9px;background:#211d13;color:#e9d18d;padding:9px 11px;margin-top:8px;font-size:11px}
        .smallnote{font-size:10px;color:#969da8;line-height:1.6;margin-top:10px}
        .footer{text-align:center;color:#777e89;font-size:10px;padding:20px}
        .withdrawnote{padding:14px;border:1px solid #3b404b;border-radius:10px;background:#15181f;color:#bdc8d4;font-size:12px;line-height:1.65}
        .withdrawform{margin-top:15px;padding:16px;border:1px solid #80632e;border-radius:12px;background:#14161b}
        .authbox{min-height:80vh;display:grid;place-items:center;padding:20px}
        .authpanel{width:100%;max-width:430px;padding:26px}
        .referral-panel{border:1px solid #70582c;background:linear-gradient(145deg,#1b1c1c,#17191f)}
        .referral-stats{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px}
        .overview-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,.8fr);gap:16px;margin-bottom:18px}
        .chart-panel,.power-card{padding:21px;min-width:0}
        .chart-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}
        .chart-title{font-size:15px;font-weight:800;color:#f0d58c}
        .chart-sub{font-size:10px;color:#8e95a0;margin-top:5px}
        .chart-area{height:155px;display:flex;align-items:end;gap:10px;padding:12px 5px 0;border-bottom:1px solid #343740;background:repeating-linear-gradient(to bottom,transparent 0,transparent 37px,#ffffff08 38px)}
        .chart-bar{flex:1;min-width:8px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#f0d58c,#96702c)}
        .chart-labels{display:flex;justify-content:space-between;color:#777f8a;font-size:9px;margin-top:9px}
        .power-number{font-size:30px;font-weight:900;color:#f2d58c;margin:12px 0 4px}
        .power-track{height:7px;background:#34302a;border-radius:10px;overflow:hidden;margin:15px 0 8px}
        .power-fill{height:100%;width:68%;background:linear-gradient(90deg,#9b742d,#f2d58c);border-radius:10px}

        /* Dedicated Mining Plans page */
        .plans-page{scroll-margin-top:100px}
        .plans-hero{padding:30px;border:1px solid #594626;border-radius:20px;background:radial-gradient(ellipse at 90% 0%,#74551d55,transparent 42%),linear-gradient(120deg,#1c1d20,#171710);margin-bottom:20px}
        .plans-hero .h1{margin-top:12px}
        .plan-rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}
        .plan-rules>div{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid #49402d;border-radius:12px;background:#111319}
        .rule-icon{width:35px;height:35px;flex:0 0 35px;display:grid;place-items:center;border-radius:10px;background:#382d19;color:#f0d58c;font-size:18px}
        .plan-rules strong{display:block;color:#f2d58c;font-size:12px}
        .plan-rules small{display:block;color:#969da8;font-size:9px;line-height:1.5;margin-top:5px}
        .plans-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}
        .plan-card{padding:19px;border:1px solid #38332a;border-radius:16px;background:linear-gradient(145deg,#1d2026,#111319);box-shadow:0 12px 30px #0003;min-width:0}
        .plan-card-4,.plan-card-7,.plan-card-8{border-color:#80632e;background:linear-gradient(145deg,#282315,#15161b)}
        .plan-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
        .plan-card .price{font-size:27px;font-weight:950;color:#fff0c4;margin:12px 0 4px}
        .plan-card .planhint{font-size:10px;color:#9299a4}
        .vip-tag{font-size:9px;color:#171717;background:linear-gradient(135deg,#f5df9e,#b9872d);padding:5px 8px;border-radius:20px;font-weight:950}
        .plan-details{margin-top:18px;border-top:1px solid #34343a}
        .plan-detail-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:11px 0;border-bottom:1px solid #292c33;font-size:10px}
        .plan-detail-row span{color:#9ca3af}
        .plan-detail-row strong{color:#e8d39c;text-align:right;font-size:10px}
        .plan-detail-row .rate-pending{color:#e6b95f}
        .invest-button{margin-top:17px}
        .plans-disclaimer{margin-top:18px;padding:17px;border:1px solid #49402d;border-radius:12px;background:#14161b}
        .plans-disclaimer strong{font-size:12px;color:#f0d58c}
        .plans-disclaimer p{font-size:11px;line-height:1.7;color:#a4abb5;margin:7px 0 0}

        @media(max-width:1150px){.plans-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:1050px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.columns,.overview-grid{grid-template-columns:1fr}.layout{grid-template-columns:1fr}.side{position:sticky;top:78px;z-index:15;height:auto;display:flex;gap:5px;overflow-x:auto;padding:9px;border-right:0;border-bottom:1px solid #292c33;background:rgba(13,16,23,.97)}.side-caption{display:none}.navbtn{flex:0 0 auto;width:auto;margin:0}}
        @media(max-width:640px){.top{height:68px;padding:10px 12px}.brand-title{font-size:11px}.logo{width:36px;height:36px}.email{display:none}.layout{min-height:calc(100vh - 68px)}.side{top:68px}.main{padding:16px 11px}.welcome{padding:18px}.panel,.chart-panel{padding:14px}.stat{padding:13px}.statvalue{font-size:16px}.navbtn{padding:10px 12px;font-size:10px}.chart-area{height:125px}.plans-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.plan-card{padding:12px}.plan-card .price{font-size:21px}.plan-detail-row{font-size:9px;gap:5px}.plan-detail-row strong{font-size:9px}.plans-hero{padding:19px}.plan-rules{grid-template-columns:1fr;gap:8px}.plan-rules>div{padding:10px}}
      `}</style>

      <header className="top">
        <div className="brand">
          <div className="logo">₿</div>
          <div>
            <div className="brand-title">CRYPTO MINING HUB</div>
            <div className="tagline">Mine Smart. Grow Digital.</div>
          </div>
        </div>
        {user && (
          <div className="topright">
            <span className="email">{user.email}</span>
            <button className="logout" onClick={logout}>Logout</button>
          </div>
        )}
      </header>

      {!user ? (
        <section className="authbox">
          <div className="panel authpanel">
            <div className="eyebrow">CRYPTO MINING HUB</div>
            <h1 className="h1">{mode === "login" ? "Welcome Back" : "Create Account"}</h1>
            <p className="muted">{mode === "login" ? "Sign in to view your account." : "Register for your account."}</p>
            <form onSubmit={authSubmit}>
              <label className="label">Email</label>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email address" />
              <label className="label">Password</label>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required placeholder="Password" />
              {mode === "register" && (
                <>
                  <label className="label">Referral Code (Optional)</label>
                  <input className="field" value={signupReferralCode} onChange={(e) => setSignupReferralCode(e.target.value.toUpperCase())} placeholder="Enter referral code" />
                </>
              )}
              <button className="primary" disabled={authBusy}>{authBusy ? "PLEASE WAIT..." : mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}</button>
            </form>
            {authMsg && <p className="muted">{authMsg}</p>}
            <p className="muted" style={{ marginTop: 16 }}>
              {mode === "login" ? "New here?" : "Already registered?"}{" "}
              <button className="copybtn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setAuthMsg(""); }}>
                {mode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </section>
      ) : (
        <div className="layout">
          <aside className="side">
            <div className="side-caption">MAIN MENU</div>
            {nav.map(([id, icon, label]) => (
              <button key={id} className={`navbtn ${section === id ? "active" : ""}`} onClick={() => go(id)}>
                <span className="navicon">{icon}</span>{label}
              </button>
            ))}
          </aside>

          <section className="main">
            <div className="welcome" id="overview">
              <div>
                <div className="eyebrow">YOUR PERSONAL DASHBOARD</div>
                <h1 className="h1">Welcome back 👋</h1>
                <p className="muted">Manage your wallet, mining plans and account activity.</p>
              </div>
              <span className="connected">● ACCOUNT CONNECTED</span>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="statlabel">Wallet Balance</div>
                <span className="statvalue">{loading ? "Loading..." : `${money(wallet?.balance)} USDT`}</span>
                <div className="statnote">USDT · BEP20</div>
              </div>
              <div className="stat">
                <div className="statlabel">Total Deposits</div>
                <span className="statvalue">{money(depositTotal)} USDT</span>
                <div className="statnote">Confirmed transactions</div>
              </div>
              <div className="stat">
                <div className="statlabel">Active Mining Plans</div>
                <span className="statvalue">{activePlans.length}</span>
                <div className="statnote">{money(activeAmount)} USDT active</div>
              </div>
              <div className="stat">
                <div className="statlabel">Total Earnings</div>
                <span className="statvalue">{money(totalProfit)} USDT</span>
                <div className="statnote">Recorded profit allocations</div>
              </div>
            </div>

            {section === "plans" ? (
              miningPlansPanel()
            ) : (
              <>
                {section === "overview" && (
                  <div className="overview-grid">
                    <div className="chart-panel">
                      <div className="chart-head">
                        <div>
                          <div className="chart-title">Earnings Overview</div>
                          <div className="chart-sub">Recorded profit activity</div>
                        </div>
                        <span className="network">USDT</span>
                      </div>
                      <div className="chart-area">
                        {[24, 38, 31, 55, 43, 70, 61, 88, 66, 96, 76, 100].map((height, i) => (
                          <div className="chart-bar" key={i} style={{ height: `${height}%` }} />
                        ))}
                      </div>
                      <div className="chart-labels"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>DEC</span></div>
                      <p className="smallnote">Decorative overview graphic. Actual earnings are shown in your recorded profit total.</p>
                    </div>
                    <div className="power-card">
                      <div className="eyebrow">MINING PERFORMANCE</div>
                      <div className="chart-title" style={{ marginTop: 8 }}>Mining Power</div>
                      <div className="power-number">{activePlans.length} <span style={{ fontSize: 13 }}>ACTIVE PLANS</span></div>
                      <div className="power-track"><div className="power-fill" /></div>
                      <div className="chart-sub">{money(activeAmount)} USDT in active plans</div>
                      <p className="smallnote">Based on confirmed active plan records.</p>
                    </div>
                  </div>
                )}

                {section === "referral" && referralPanel()}

                {loadError && <p className="error">Data issue: {loadError}</p>}

                <div className="columns">
                  <div>
                    {section === "investments" && (
                      <div className="panel" id="investments">
                        <div className="panelhead">
                          <div>
                            <h2>My Investments</h2>
                            <p className="muted">View your mining plans and their current status.</p>
                          </div>
                          <button className="secondary" onClick={loadData} disabled={loading}>{loading ? "Loading..." : "↻ Refresh"}</button>
                        </div>
                        {purchases.length === 0 ? (
                          <div className="empty">No investment records found.</div>
                        ) : (
                          <div className="list">
                            {purchases.map((p) => (
                              <div className="item" key={p.id}>
                                <div className="itemtop">
                                  <div className="itemamount">{p.plan_name || "Plan"} · ${money(p.price_usdt || p.principal_usdt)}</div>
                                  <span className={`badge ${statusClass(p.status)}`}>{p.status || "Unknown"}</span>
                                </div>
                                <div className="detail">Created: {dateText(p.created_at)}{p.activated_at ? ` · Activated: ${dateText(p.activated_at)}` : ""}</div>
                                <div className="detail">Plan term: {LOCK_DAYS} days (displayed plan term)</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {section === "deposit" && (
                      <div className="panel" id="deposit">
                        <h2>Make a Deposit</h2>
                        <p className="muted">Deposit using USDT on BNB Smart Chain (BEP20).</p>
                        <form onSubmit={createDeposit}>
                          <label className="label">Deposit Amount (USD)</label>
                          <input className="field" type="number" min="1" max="10000" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required />
                          <button className="primary" disabled={!!busyAction}>{busyAction === "deposit" ? "CREATING PAYMENT..." : "CREATE DEPOSIT PAYMENT"}</button>
                        </form>
                        {actionMsg && payment?.kind === "deposit" && <p className="message">{actionMsg}</p>}
                        {payment?.kind === "deposit" && paymentDetails(payment, "DEPOSIT PAYMENT DETAILS")}
                        {actionMsg && !payment && <p className="error">{actionMsg}</p>}
                      </div>
                    )}

                    {section === "deposits" && (
                      <div className="panel" id="deposits">
                        <h2>Deposit History</h2>
                        {deposits.length === 0 ? <div className="empty">No deposit records found.</div> : (
                          <div className="list">
                            {deposits.map((d) => (
                              <div className="item" key={d.id}>
                                <div className="itemtop">
                                  <span className="itemamount">${money(d.price_amount ?? d.amount)}</span>
                                  <span className={`badge ${statusClass(d.status)}`}>{d.status || "Pending"}</span>
                                </div>
                                <div className="detail">{d.currency || "USDT"} · {d.network || "Network not set"} · {dateText(d.created_at)}</div>
                                {d.provider_payment_id && <div className="detail">Payment ID: {d.provider_payment_id}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {section === "wallet" && (
                      <div className="panel" id="wallet">
                        <h2>My Wallet</h2>
                        <p className="muted">Your USDT BEP20 wallet balance.</p>
                        <div className="walletbox">
                          <div className="muted">AVAILABLE BALANCE</div>
                          <div className="balance">{loading ? "Loading..." : `${money(wallet?.balance)} USDT`}</div>
                          <span className="network">BNB Smart Chain · BEP20</span>
                        </div>
                        {!wallet && !loading && <p className="muted">Wallet record not found.</p>}
                        <button className="primary" type="button" disabled={loading || !!busyAction} onClick={() => { setWithdrawOpen(!withdrawOpen); setWithdrawError(""); setWithdrawMsg(""); }}>
                          {withdrawOpen ? "CLOSE WITHDRAWAL FORM" : "WITHDRAW"}
                        </button>
                        {withdrawOpen && (
                          <form className="withdrawform" onSubmit={submitWithdrawal}>
                            <h3>Withdraw USDT</h3>
                            <p className="muted">Minimum withdrawal: $10 USDT. Network: BEP20.</p>
                            <label className="label">Withdrawal Amount (USDT)</label>
                            <input className="field" type="number" min="10" step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
                            <label className="label">USDT BEP20 Wallet Address</label>
                            <input className="field" type="text" placeholder="Enter your BEP20 wallet address" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} minLength={20} maxLength={150} required />
                            <p className="detail">Available wallet balance: {money(wallet?.balance)} USDT</p>
                            {Number(wallet?.balance || 0) < 10 && <div className="withdrawnote">Your available balance is below the $10 minimum.</div>}
                            <button className="primary" type="submit" disabled={!!busyAction || Number(withdrawAmount) < 10 || Number(withdrawAmount) > Number(wallet?.balance || 0)}>
                              {busyAction === "withdraw" ? "SUBMITTING..." : "SUBMIT WITHDRAWAL"}
                            </button>
                            {withdrawError && <p className="error">{withdrawError}</p>}
                          </form>
                        )}
                        {withdrawMsg && <p className="message">{withdrawMsg}</p>}
                      </div>
                    )}

                    {section === "withdrawals" && (
                      <div className="panel" id="withdrawals">
                        <h2>Withdrawals</h2>
                        <p className="muted">Withdrawal network: USDT BEP20.</p>
                        <button className="secondary" type="button" onClick={() => { setWithdrawOpen(true); go("wallet"); }}>+ NEW WITHDRAWAL</button>
                        {withdrawError && <p className="error">{withdrawError}</p>}
                        {withdrawMsg && <p className="message">{withdrawMsg}</p>}
                        {withdrawals.length === 0 ? <div className="empty" style={{ marginTop: 14 }}>No withdrawal requests found.</div> : (
                          <div className="list">
                            {withdrawals.map((w) => (
                              <div className="item" key={w.id}>
                                <div className="itemtop">
                                  <span className="itemamount">{money(w.amount)} {w.currency || "USDT"}</span>
                                  <span className={`badge ${statusClass(w.status)}`}>{w.status || "Pending"}</span>
                                </div>
                                <div className="detail">Network: {w.network || "BEP20"}</div>
                                <div className="detail">Wallet: {w.wallet_address || "—"}</div>
                                <div className="detail">Submitted: {dateText(w.created_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {section === "profit" && (
                      <div className="panel" id="profit">
                        <h2>Profit &amp; Loss</h2>
                        <p className="muted">Your recorded investment profit allocations.</p>
                        <div className="walletbox">
                          <div className="muted">TOTAL RECORDED PROFIT</div>
                          <div className="balance">{money(totalProfit)} USDT</div>
                          <span className="network">Recorded allocations only</span>
                        </div>
                        <div className="withdrawnote" style={{ marginTop: 12 }}>
                          Total approved withdrawals: {money(totalWithdrawn)} USDT. Profit figures are based only on records entered and allocated by the platform. They are not guaranteed earnings.
                        </div>
                        {profits.length === 0 ? <div className="empty" style={{ marginTop: 14 }}>No profit allocations have been recorded for your account yet.</div> : (
                          <div className="list">
                            {profits.map((p) => (
                              <div className="item" key={p.id}>
                                <div className="itemtop">
                                  <span className="itemamount">+{money(p.profit_usdt)} USDT</span>
                                  <span className="badge ok">ALLOCATED</span>
                                </div>
                                <div className="detail">Period: {p.period_name || "—"} · Plan: {p.plan_name || "—"}</div>
                                <div className="detail">Principal: {money(p.principal_usdt)} USDT · Source: {p.source || "—"}</div>
                                <div className="detail">Recorded: {dateText(p.created_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {section === "account" && (
                      <div className="panel" id="account">
                        <h2>Account</h2>
                        <p className="muted">Signed in email</p>
                        <div style={{ overflowWrap: "anywhere", margin: "12px 0" }}>{user.email}</div>
                        <span className="network">Supabase authenticated account</span>
                        <h3 style={{ marginTop: 22 }}>Apply Referral Code</h3>
                        {referralAlreadyLinked ? (
                          <div className="empty">A referral code has already been linked to this account.</div>
                        ) : (
                          <form onSubmit={applyReferralCode}>
                            <label className="label">Referral Code</label>
                            <input className="field" value={accountReferralCode} onChange={(e) => setAccountReferralCode(e.target.value.toUpperCase())} placeholder="Enter referral code" required />
                            <button className="primary" type="submit" disabled={referralApplyBusy}>{referralApplyBusy ? "APPLYING..." : "APPLY CODE"}</button>
                          </form>
                        )}
                        {referralApplyMsg && <p className="message">{referralApplyMsg}</p>}
                        <button className="secondary" style={{ marginTop: 14 }} onClick={logout}>Sign Out</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <footer className="footer">© {new Date().getFullYear()} Crypto Mining Hub · Mine Smart. Grow Digital.</footer>
          </section>
        </div>
      )}
    </main>
  );
}
