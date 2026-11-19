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
  ["overview", "◈", "Overview"],
  ["referral", "👥", "Referral / Affiliate"],
  ["investments", "▣", "My Investments"],
  ["plans", "◇", "Investment Plans"],
  ["deposit", "↓", "Deposit"],
  ["wallet", "◉", "My Wallet"],
  ["deposits", "↙", "Deposit History"],
  ["withdrawals", "↗", "Withdrawals"],
  ["profit", "％", "Profit & Loss"],
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
  if (["approved", "active", "finished", "paid", "posted"].includes(status)) return "ok";
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
    const codeFromLink = params.get("ref");

    if (codeFromLink) {
      setSignupReferralCode(codeFromLink.trim().toUpperCase());
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
    if (user) {
      loadData();
    } else {
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
            data: referralCode
              ? { referral_code: referralCode }
              : {},
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
        body: JSON.stringify({ amount: Number(depositAmount) }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Deposit creation failed.");
      }

      setPayment({ ...result, kind: "deposit", amount: Number(depositAmount) });
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

      setPayment({ ...result, kind: "plan", amount: plan.price, planName: plan.name });
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
        body: JSON.stringify({
          amount,
          wallet_address: address,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Withdrawal request failed.");
      }

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
    (sum, x) => sum + Number(x.actually_paid || x.amount || 0),
    0
  );

  const activePlans = purchases.filter(
    (x) => String(x.status).toLowerCase() === "active"
  );

  const activeAmount = activePlans.reduce(
    (sum, x) => sum + Number(x.principal_usdt || x.price_usdt || 0),
    0
  );

  const totalProfit = profits.reduce(
    (sum, x) => sum + Number(x.profit_usdt || 0),
    0
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
        supabase
          .from("referral_profiles")
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

      if (!code) {
        throw new Error("Enter a referral code.");
      }

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

    const inviteUrl =
      `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

    const shareText =
      `Join Crypto Mining Hub using my referral code: ${code}\n${inviteUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Crypto Mining Hub Invitation",
          text: shareText,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setReferralError("");
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

    if (id === "referral" || id === "account") {
      loadReferralData();
    }

    setPayment(null);
    setActionMsg("");

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function copyAddress(address) {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setActionMsg("Copied successfully.");
    } catch {
      setActionMsg("Copy failed. Please copy the text manually.");
    }
  }

  function paymentDetails(pay, title) {
    if (!pay) return null;

    return (
      <div className="paybox">
        <div className="paytitle">{title}</div>
        <p className="detail">
          Send the exact amount using USDT on BNB Smart Chain (BEP20).
        </p>

        <div className="label">Amount to Send</div>
        <div className="payvalue">
          {pay.pay_amount} {pay.pay_currency || "USDT"}
        </div>

        <div className="label">Payment Address</div>
        <div className="payvalue">
          {pay.pay_address || "Address not returned"}
        </div>

        {pay.payment_id && <div className="detail">Payment ID: {pay.payment_id}</div>}
        {pay.order_id && <div className="detail">Order ID: {pay.order_id}</div>}

        <button
          type="button"
          className="copybtn"
          onClick={() => copyAddress(pay.pay_address)}
        >
          COPY ADDRESS
        </button>

        <p className="smallnote">
          Confirm the address, amount and network before sending. The plan activates after payment confirmation.
        </p>
      </div>
    );
  }

  function referralPanel() {
    return (
      <div className="panel referral-panel" id="referral">
        <div className="panelhead">
          <div>
            <div className="eyebrow">INVITE & EARN</div>
            <h2>Referral / Affiliate Programme</h2>
            <p className="muted">
              Invite friends and earn commissions when their Mining Plans are confirmed.
            </p>
          </div>

          <button
            className="secondary"
            type="button"
            onClick={loadReferralData}
            disabled={referralLoading}
          >
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
              <div className="balance" style={{ fontSize: "25px" }}>
                {referralData.referral_code || "Not available"}
              </div>

              <button
                className="copybtn"
                type="button"
                onClick={() => copyAddress(referralData.referral_code)}
              >
                COPY CODE
              </button>

              <button
                className="primary"
                type="button"
                onClick={shareInvite}
              >
                SHARE INVITE
              </button>

              <div className="smallnote">
                Share your invite link. New users can register using your referral code.
              </div>
            </div>

            <div className="stats referral-stats" style={{ marginTop: "14px" }}>
              <div className="stat">
                <div className="statlabel">People Referred</div>
                <span className="statvalue">
                  {referralData.referrals_count || 0}
                </span>
              </div>

              <div className="stat">
                <div className="statlabel">Total Commission</div>
                <span className="statvalue">
                  {money(referralData.total_commission)} USDT
                </span>
              </div>
            </div>

            <h3>Commission Levels</h3>
            <div className="list">
              {[{ level: 1, rate: 10 }, { level: 2, rate: 3 }, { level: 3, rate: 2 }].map((x) => {
                const row = (referralData.level_totals || []).find(
                  (v) => Number(v.level) === x.level
                );

                return (
                  <div className="item" key={x.level}>
                    <div className="itemtop">
                      <span className="itemamount">
                        Level {x.level} · {x.rate}%
                      </span>
                      <span className="badge ok">
                        {money(row?.total)} USDT
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{ marginTop: "18px" }}>Commission History</h3>

            {(referralData.commissions || []).length === 0 ? (
              <div className="empty">
                No referral commissions yet. Commissions appear after a referred user's Mining Plan payment is confirmed.
              </div>
            ) : (
              <div className="list">
                {referralData.commissions.map((c) => (
                  <div className="item" key={c.id}>
                    <div className="itemtop">
                      <span className="itemamount">
                        +{money(c.commission_amount)} USDT
                      </span>
                      <span className={`badge ${statusClass(c.status)}`}>
                        {c.status || "pending"}
                      </span>
                    </div>
                    <div className="detail">
                      Level {c.level} · Rate {c.commission_rate}% · Plan amount {money(c.base_amount)} USDT
                    </div>
                    <div className="detail">
                      Date: {dateText(c.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="smallnote">
              Commissions: Level 1 = 10%, Level 2 = 3%, Level 3 = 2%.
              Paid only after confirmed Mining Plan purchases.
              Deposits do not earn referral commission.
            </p>
          </>
        ) : (
          <div className="empty">
            Referral details are not available yet. Tap Refresh to try again.
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="cmh">
      <style jsx global>{`
        *{box-sizing:border-box}
        body{margin:0;background:#070b08;color:#eff5ef;font-family:Inter,Arial,sans-serif}
        button,input{font:inherit}
        button{cursor:pointer}
        .cmh{min-height:100vh;background:radial-gradient(ellipse at 90% 0,rgba(20,120,65,.2),transparent 34%),radial-gradient(ellipse at 5% 15%,rgba(184,143,48,.08),transparent 28%),#070b08;color:#eff5ef}
        .top{background:rgba(8,14,10,.96);border-bottom:1px solid #253b2a;min-height:78px;padding:16px 3%;display:flex;justify-content:space-between;align-items:center;gap:12px}
        .brand{display:flex;gap:11px;align-items:center}
        .logo{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(140deg,#b7f2c8,#3ba66c);color:#07120a;font-weight:900;font-size:22px}
        .brand-title{font-weight:900;color:#d9f5e1;letter-spacing:1.1px;font-size:14px}
        .tagline{font-size:10px;color:#809684;margin-top:4px}
        .topright{display:flex;gap:12px;align-items:center}
        .email{font-size:11px;color:#aab0a7;max-width:200px;overflow-wrap:anywhere}
        .logout,.secondary{padding:9px 13px;border:1px solid #36533b;border-radius:9px;color:#a8e8bc;background:#142119}
        .layout{display:grid;grid-template-columns:245px minmax(0,1fr);max-width:1600px;margin:auto;min-height:calc(100vh - 78px)}
        .side{padding:25px 15px;border-right:1px solid #243b29;background:#090f0b}
        .side-caption{font-size:10px;color:#66806b;letter-spacing:1.8px;margin:8px 10px 14px}
        .navbtn{width:100%;display:flex;text-align:left;gap:11px;align-items:center;padding:13px;border:1px solid transparent;border-radius:12px;background:transparent;color:#a2b6a5;font-size:12px;margin:4px 0}
        .navicon{width:22px;text-align:center;font-size:16px}
        .navbtn:hover{background:#14271a;color:#e0f5e5}
        .navbtn.active{background:linear-gradient(100deg,#173d27,#122117);border-color:#315c3c;color:#a8edbf;box-shadow:inset 3px 0 #4fc27e}
        .main{padding:32px clamp(16px,3vw,48px);min-width:0}
        .welcome{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:26px}
        .eyebrow{font-size:10px;letter-spacing:2px;color:#70d797;font-weight:bold}
        .h1{font-size:clamp(24px,4vw,34px);margin:8px 0;color:#f3f8f3;font-weight:800}
        .muted{font-size:12px;color:#8fa391;line-height:1.65}
        .connected{border:1px solid #28613b;background:#102a1a;color:#83dfa3;border-radius:30px;padding:8px 12px;font-size:10px;font-weight:bold}
        .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
        .stat,.panel,.plan{background:linear-gradient(145deg,#141e16,#0e150f);border:1px solid #293d2d;border-radius:16px;box-shadow:0 8px 25px #0002}
        .stat{padding:19px;min-width:0}
        .statlabel{color:#91a495;font-size:11px}
        .statvalue{display:block;margin-top:8px;color:#b8edca;font-weight:900;font-size:clamp(16px,2vw,23px);overflow-wrap:anywhere}
        .statnote{margin-top:7px;font-size:10px;color:#6d8672}
        .columns{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(250px,.8fr);gap:18px;align-items:start}
        .panel{padding:21px;margin-bottom:18px;min-width:0;scroll-margin-top:18px}
        .panel h2{font-size:16px;color:#b8edca;margin:0 0 7px}
        .panel h3{font-size:13px;color:#e7f1e8;margin:0 0 8px}
        .panelhead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
        .walletbox{margin-top:13px;padding:22px;border:1px solid #346c43;border-radius:15px;background:linear-gradient(135deg,#163d26,#101b12)}
        .balance{font-size:clamp(25px,5vw,35px);font-weight:900;color:#d3f4dc;margin:10px 0;overflow-wrap:anywhere}
        .network{display:inline-block;padding:7px 10px;border-radius:8px;color:#91e9ae;background:#173624;border:1px solid #2c6240;font-size:10px}
        .plans{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px;align-items:start}
        .plan{padding:16px;background:linear-gradient(145deg,#17231a,#101711);min-width:0}
        .planname{color:#91e5ad;font-size:11px;font-weight:900;letter-spacing:1.4px}
        .price{margin:8px 0;color:#e1f1e4;font-size:23px;font-weight:900}
        .planhint{color:#839786;font-size:10px;margin-bottom:12px}
        .label{display:block;margin:14px 0 7px;color:#b8bdb3;font-size:11px}
        .field{display:block;width:100%;padding:13px;border:1px solid #35513a;border-radius:10px;outline:none;background:#080e09;color:white}
        .field:focus{border-color:#68cf8d}
        .primary{display:block;width:100%;padding:13px;margin-top:12px;border:none;border-radius:10px;color:#07130a;background:linear-gradient(135deg,#a8edbe,#40ac72);font-weight:900}
        .primary:disabled{opacity:.45;cursor:not-allowed}
        .list{display:grid;gap:10px;margin-top:13px}
        .item{padding:14px;border:1px solid #2b3e30;border-radius:12px;background:#111a13;min-width:0}
        .itemtop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
        .itemamount{color:#b5edc8;font-size:14px;font-weight:800;overflow-wrap:anywhere}
        .detail{margin-top:7px;color:#899087;font-size:10px;line-height:1.7;overflow-wrap:anywhere}
        .badge{display:inline-block;padding:6px 9px;border-radius:20px;font-size:10px;font-weight:bold}
        .badge.ok{color:#9aebba;background:#153522;border:1px solid #28613b}
        .badge.pending{color:#e7c873;background:#342a15;border:1px solid #4b4230}
        .badge.other{color:#c0c5bb;background:#252a24;border:1px solid #394239}
        .empty{border:1px dashed #344a37;border-radius:9px;padding:22px;text-align:center;color:#859787;font-size:11px}
        .message{font-size:12px;color:#8bd6a0;margin-top:10px;overflow-wrap:anywhere}
        .error{font-size:12px;color:#ff8585;margin-top:10px;overflow-wrap:anywhere}
        .paybox{border:1px solid #7c642d;background:#211d12;border-radius:12px;padding:14px;margin-top:14px;overflow-wrap:anywhere;width:100%;min-width:0}
        .paytitle{font-size:13px;font-weight:900;color:#d9c077}
        .payvalue{word-break:break-all;background:#080e09;padding:10px;border-radius:7px;margin-top:7px;font-size:11px;color:#d8f0dc}
        .copybtn{border:1px solid #36533b;border-radius:9px;background:#142119;color:#a8e8bc;padding:9px 11px;margin-top:8px;font-size:11px}
        .smallnote{font-size:10px;color:#899087;line-height:1.6;margin-top:10px}
        .footer{text-align:center;color:#58705d;font-size:10px;padding:20px}
        .withdrawnote{padding:14px;border:1px solid #2b3e30;border-radius:10px;background:#111a13;color:#a3b4a5;font-size:12px;line-height:1.65}
        .withdrawform{margin-top:15px;padding:16px;border:1px solid #346c43;border-radius:12px;background:#0c160f}
        .authbox{min-height:80vh;display:grid;place-items:center;padding:20px}
        .authpanel{width:100%;max-width:430px;padding:26px}
        .referral-panel{border:2px solid #39734a;background:linear-gradient(145deg,#14251a,#0e150f);scroll-margin-top:20px}
        .referral-panel .eyebrow{margin-bottom:8px}
        .referral-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        @media(max-width:980px){
          .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
          .columns{grid-template-columns:1fr}
          .layout{grid-template-columns:1fr}
          .side{display:flex;gap:5px;overflow-x:auto;padding:9px;border-right:0;border-bottom:1px solid #243b29}
          .side-caption{display:none}
          .navbtn{flex:0 0 auto;width:auto;margin:0}
        }
        @media(max-width:640px){
          .top{padding:12px}
          .brand-title{font-size:11px}
          .logo{width:36px;height:36px}
          .email{display:none}
          .main{padding:16px 11px}
          .panel{padding:14px}
          .stat{padding:12px}
          .statvalue{font-size:16px}
          .plan{padding:11px}
          .plans{gap:9px}
          .price{font-size:20px}
          .navbtn{padding:10px 12px;font-size:10px}
        }
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
            <p className="muted">
              {mode === "login" ? "Sign in to view your account." : "Register for your account."}
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

              {mode === "register" && (
                <>
                  <label className="label">Referral Code (Optional)</label>
                  <input
                    className="field"
                    type="text"
                    value={signupReferralCode}
                    onChange={(e) =>
                      setSignupReferralCode(e.target.value.toUpperCase())
                    }
                    placeholder="Enter referral code"
                  />
                </>
              )}

              <button className="primary" disabled={authBusy}>
                {authBusy ? "PLEASE WAIT..." : mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
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
            <div className="side-caption">MAIN MENU</div>
            {nav.map(([id, icon, label]) => (
              <button
                key={id}
                className={`navbtn ${section === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                <span className="navicon">{icon}</span>
                {label}
              </button>
            ))}
          </aside>

          <section className="main">
            <div className="welcome" id="overview">
              <div>
                <div className="eyebrow">ACCOUNT OVERVIEW</div>
                <h1 className="h1">Welcome back 👋</h1>
                <p className="muted">Manage your wallet, investments and account activity.</p>
              </div>
              <span className="connected">● ACCOUNT CONNECTED</span>
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
                <div className="statnote">Confirmed transactions</div>
              </div>

              <div className="stat">
                <div className="statlabel">Active Plans</div>
                <span className="statvalue">{activePlans.length}</span>
                <div className="statnote">{money(activeAmount)} USDT recorded</div>
              </div>

              <div className="stat">
                <div className="statlabel">Total Profit</div>
                <span className="statvalue">{money(totalProfit)} USDT</span>
                <div className="statnote">Recorded allocations</div>
              </div>
            </div>

            {referralPanel()}

            {loadError && <p className="error">Data issue: {loadError}</p>}

            <div className="columns">
              <div>
                <div className="panel" id="investments">
                  <div className="panelhead">
                    <div>
                      <h2>My Investments</h2>
                      <p className="muted">View your investment plans and current status.</p>
                    </div>
                    <button className="secondary" onClick={loadData} disabled={loading}>
                      {loading ? "Loading..." : "↻ Refresh"}
                    </button>
                  </div>

                  {purchases.length === 0 ? (
                    <div className="empty">No investment records found.</div>
                  ) : (
                    <div className="list">
                      {purchases.map((p) => (
                        <div className="item" key={p.id}>
                          <div className="itemtop">
                            <div className="itemamount">
                              {p.plan_name || "Plan"} · ${money(p.price_usdt || p.principal_usdt)}
                            </div>
                            <span className={`badge ${statusClass(p.status)}`}>
                              {p.status || "Unknown"}
                            </span>
                          </div>
                          <div className="detail">
                            Created: {dateText(p.created_at)}
                            {p.activated_at ? ` · Activated: ${dateText(p.activated_at)}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel" id="plans">
                  <h2>Investment Plans</h2>
                  <p className="muted">
                    Choose a plan. Payment uses USDT on BEP20. Activation follows payment confirmation.
                  </p>

                  <div className="plans">
                    {plans.map((plan) => (
                      <div className="plan" key={plan.name}>
                        <div className="planname">{plan.name}</div>
                        <div className="price">${plan.price.toLocaleString("en-US")}</div>
                        <div className="planhint">USDT · BEP20</div>

                        <button
                          className="primary"
                          onClick={() => buyPlan(plan)}
                          disabled={!!busyAction}
                        >
                          {busyAction === plan.name ? "CREATING PAYMENT..." : "BUY PLAN"}
                        </button>

                        {payment?.kind === "plan" &&
                          payment?.planName === plan.name &&
                          paymentDetails(payment, `${plan.name} PAYMENT DETAILS`)}
                      </div>
                    ))}
                  </div>

                  {actionMsg && <p className="error">{actionMsg}</p>}
                </div>

                <div className="panel" id="deposit">
                  <h2>Make a Deposit</h2>
                  <p className="muted">Deposit using USDT on BNB Smart Chain (BEP20).</p>

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
                      {busyAction === "deposit" ? "CREATING PAYMENT..." : "CREATE DEPOSIT PAYMENT"}
                    </button>
                  </form>

                  {actionMsg && payment?.kind === "deposit" && (
                    <p className="message">{actionMsg}</p>
                  )}

                  {payment?.kind === "deposit" &&
                    paymentDetails(payment, "DEPOSIT PAYMENT DETAILS")}
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
                            <span className={`badge ${statusClass(d.status)}`}>
                              {d.status || "Pending"}
                            </span>
                          </div>
                          <div className="detail">
                            {d.currency || "USDT"} · {d.network || "Network not set"} · {dateText(d.created_at)}
                          </div>
                          {d.provider_payment_id && (
                            <div className="detail">Payment ID: {d.provider_payment_id}</div>
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
                  <p className="muted">Balance for your USDT BEP20 wallet.</p>

                  <div className="walletbox">
                    <div className="muted">AVAILABLE BALANCE</div>
                    <div className="balance">
                      {loading ? "Loading..." : `${money(wallet?.balance)} USDT`}
                    </div>
                    <span className="network">BNB Smart Chain · BEP20</span>
                  </div>

                  {!wallet && !loading && (
                    <p className="muted">Wallet record not found. Make a deposit to activate your wallet.</p>
                  )}

                  <button
                    className="primary"
                    type="button"
                    disabled={loading || !!busyAction}
                    onClick={() => {
                      setWithdrawOpen(!withdrawOpen);
                      setSection("wallet");
                      setWithdrawError("");
                      setWithdrawMsg("");
                    }}
                  >
                    {withdrawOpen ? "CLOSE WITHDRAWAL FORM" : "WITHDRAW"}
                  </button>

                  {withdrawOpen && (
                    <form className="withdrawform" onSubmit={submitWithdrawal}>
                      <h3>Withdraw USDT</h3>
                      <p className="muted">
                        Minimum withdrawal: $10 USDT. Network: BEP20.
                      </p>

                      <label className="label">Withdrawal Amount (USDT)</label>
                      <input
                        className="field"
                        type="number"
                        min="10"
                        step="0.01"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        required
                      />

                      <label className="label">USDT BEP20 Wallet Address</label>
                      <input
                        className="field"
                        type="text"
                        placeholder="Enter your BEP20 wallet address"
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        minLength={20}
                        maxLength={150}
                        required
                      />

                      <p className="detail">
                        Available balance: {money(wallet?.balance)} USDT
                      </p>

                      {Number(wallet?.balance || 0) < 10 && (
                        <div className="withdrawnote" style={{ marginTop: 12 }}>
                          Your available balance is below the $10 minimum. You can fill in the form, but the request cannot be submitted until your wallet has at least $10 USDT.
                        </div>
                      )}

                      <button
                        className="primary"
                        type="submit"
                        disabled={!!busyAction || Number(withdrawAmount) < 10 || Number(withdrawAmount) > Number(wallet?.balance || 0)}
                      >
                        {busyAction === "withdraw" ? "SUBMITTING..." : "SUBMIT WITHDRAWAL"}
                      </button>

                      {withdrawError && <p className="error">{withdrawError}</p>}
                    </form>
                  )}

                  {withdrawMsg && <p className="message">{withdrawMsg}</p>}
                </div>

                <div className="panel" id="withdrawals">
                  <h2>Withdrawals</h2>
                  <p className="muted">Withdrawal network: USDT BEP20.</p>

                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      setWithdrawOpen(true);
                      go("wallet");
                    }}
                  >
                    + NEW WITHDRAWAL
                  </button>

                  {withdrawError && <p className="error">{withdrawError}</p>}
                  {withdrawMsg && <p className="message">{withdrawMsg}</p>}

                  {withdrawals.length === 0 ? (
                    <div className="empty" style={{ marginTop: 14 }}>
                      No withdrawal requests found.
                    </div>
                  ) : (
                    <div className="list">
                      {withdrawals.map((w) => (
                        <div className="item" key={w.id}>
                          <div className="itemtop">
                            <span className="itemamount">
                              {money(w.amount)} {w.currency || "USDT"}
                            </span>
                            <span className={`badge ${statusClass(w.status)}`}>
                              {w.status || "Pending"}
                            </span>
                          </div>
                          <div className="detail">Network: {w.network || "BEP20"}</div>
                          <div className="detail">Wallet: {w.wallet_address || "—"}</div>
                          <div className="detail">Submitted: {dateText(w.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel" id="profit">
                  <h2>Profit &amp; Loss</h2>
                  <p className="muted">Your recorded investment profit allocations.</p>

                  <div className="walletbox">
                    <div className="muted">TOTAL RECORDED PROFIT</div>
                    <div className="balance">{money(totalProfit)} USDT</div>
                    <span className="network">Recorded allocations only</span>
                  </div>

                  <div className="withdrawnote" style={{ marginTop: 12 }}>
                    Total approved withdrawals: {money(totalWithdrawn)} USDT.
                    Profit figures are based only on records entered and allocated by the platform. They are not guaranteed earnings.
                  </div>

                  {profits.length === 0 ? (
                    <div className="empty" style={{ marginTop: 14 }}>
                      No profit allocations have been recorded for your account yet.
                    </div>
                  ) : (
                    <div className="list">
                      {profits.map((p) => (
                        <div className="item" key={p.id}>
                          <div className="itemtop">
                            <span className="itemamount">
                              +{money(p.profit_usdt)} USDT
                            </span>
                            <span className="badge ok">ALLOCATED</span>
                          </div>
                          <div className="detail">
                            Period: {p.period_name || "—"} · Plan: {p.plan_name || "—"}
                          </div>
                          <div className="detail">
                            Principal: {money(p.principal_usdt)} USDT · Source: {p.source || "—"}
                          </div>
                          <div className="detail">Recorded: {dateText(p.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel" id="account">
                  <h2>Account</h2>
                  <p className="muted">Signed in email</p>
                  <div style={{ overflowWrap: "anywhere", margin: "12px 0" }}>
                    {user.email}
                  </div>
                  <span className="network">Supabase authenticated account</span>

                  <h3 style={{ marginTop: 22 }}>Apply Referral Code</h3>
                  {referralAlreadyLinked ? (
                    <div className="empty">
                      A referral code has already been linked to this account.
                    </div>
                  ) : (
                    <form onSubmit={applyReferralCode}>
                      <label className="label">Referral Code</label>
                      <input
                        className="field"
                        type="text"
                        value={accountReferralCode}
                        onChange={(e) =>
                          setAccountReferralCode(e.target.value.toUpperCase())
                        }
                        placeholder="Enter referral code"
                        required
                      />
                      <button
                        className="primary"
                        type="submit"
                        disabled={referralApplyBusy}
                      >
                        {referralApplyBusy ? "APPLYING..." : "APPLY CODE"}
                      </button>
                    </form>
                  )}

                  {referralApplyMsg && (
                    <p className="message">{referralApplyMsg}</p>
                  )}

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
              © {new Date().getFullYear()} Crypto Mining Hub · Mine Smart. Grow Digital.
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}