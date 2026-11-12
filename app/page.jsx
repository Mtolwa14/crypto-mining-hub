
const stats = [
  { title: "Wallet Balance", value: "$0.00", icon: "💰" },
  { title: "Total Deposits", value: "$0.00", icon: "📥" },
  { title: "Withdrawals", value: "$0.00", icon: "📤" },
  { title: "Mining Status", value: "Coming Soon", icon: "⛏️" }
];

export default function Home() {
  return (
    <main className="container">
      <header className="header">
        <div className="brand">
          <span className="logo">₿</span>
          <div>
            <h2>CRYPTO MINING HUB</h2>
            <small>Mine Smart. Grow Digital.</small>
          </div>
        </div>
        <span className="demo">DEMO</span>
      </header>

      <section className="welcome">
        <p>WELCOME TO YOUR PLATFORM</p>
        <h1>Build Your Crypto Future.</h1>
        <p>Manage your wallet and explore digital mining.</p>
        <button>Get Started</button>
      </section>

      <h2 className="section-title">My Dashboard</h2>

      <section className="stats">
        {stats.map((item) => (
          <div className="card" key={item.title}>
            <span className="icon">{item.icon}</span>
            <p>{item.title}</p>
            <h2>{item.value}</h2>
          </div>
        ))}
      </section>

      <section className="actions">
        <h2>Wallet Actions</h2>
        <div className="action-grid">
          <button className="action">📥 Deposit</button>
          <button className="action">📤 Withdraw</button>
          <button className="action">📊 Transactions</button>
          <button className="action">👤 My Account</button>
        </div>
      </section>

      <section className="mining">
        <h2>⛏️ Mining Center</h2>
        <p>Mining integration is coming soon.</p>
        <span>Not connected to a mining pool yet.</span>
      </section>

      <footer>
        © 2026 Crypto Mining Hub. All rights reserved.
      </footer>
    </main>
  );
}
