import { useState, useEffect } from "react";

const ANTHROPIC_API_URL = "/.netlify/functions/analyze";
const STRIPE_PAYMENT_URL = "/.netlify/functions/create-checkout";
const ADMIN_API_URL = "/.netlify/functions/get-analyses";

const EXAMPLES = [
  { idea: "AI content agency", claim: "€10,000/month", time: "30 days" },
  { idea: "Faceless YouTube channel with AI", claim: "€5,000/month", time: "60 days" },
  { idea: "AI chatbot for restaurants", claim: "€3,000/month passive", time: "2 weeks" },
];

function getAdminToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || null;
}

function isAdminMode() {
  return !!getAdminToken();
}

function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function ScoreBar({ score }) {
  return (
    <div className="score-wrap">
      <div className="score-track">
        <div className="score-fill" style={{ width: `${score * 10}%` }} />
      </div>
      <span className="score-num">{score}<span className="score-denom">/10</span></span>
    </div>
  );
}

function ResultCard({ data, locked, onUnlock, loading }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-tag">ANALYSIS</span>
        <span className="card-brand">CASHORCLOUT.COM</span>
      </div>
      <section className="card-section">
        <h3 className="section-label">IDEA IN PLAIN ENGLISH</h3>
        <p className="section-body">{data.plainEnglish}</p>
      </section>
      <section className="card-section">
        <h3 className="section-label">WHAT WOULD NEED TO BE TRUE</h3>
        <ul className="truth-list">
          {data.truths.map((t, i) => (
            <li key={i}><span className="truth-dot">→</span>{t}</li>
          ))}
        </ul>
      </section>
      <div className="card-row">
        <section className="card-section half">
          <h3 className="section-label">EFFORT REALITY</h3>
          <ScoreBar score={data.effortScore} />
        </section>
        <section className="card-section half">
          <h3 className="section-label">ACTUALLY "EASY"?</h3>
          <span className={`easy-badge ${data.isEasy === "Yes" ? "yes" : data.isEasy === "No" ? "no" : "maybe"}`}>
            {data.isEasy}
          </span>
        </section>
      </div>
      <div className="card-row">
        <section className="card-section half">
          <h3 className="section-label">WHY IT FEELS EASY</h3>
          <p className="section-body small">{data.whyFeelsEasy}</p>
        </section>
        <section className="card-section half">
          <h3 className="section-label">WHY IT'S NOT</h3>
          <p className="section-body small">{data.whyNot}</p>
        </section>
      </div>
      <section className="card-section">
        <h3 className="section-label">REALISTIC TIME BEFORE FIRST €1</h3>
        <p className="time-value">{data.realisticTime}</p>
      </section>
      <div className={`locked-zone ${locked ? "is-locked" : "is-unlocked"}`}>
        {locked && (
          <div className="lock-overlay">
            <div className="lock-content">
              <div className="lock-icon">🔒</div>
              <p className="lock-title">Verdict + What Actually Works</p>
              <p className="lock-sub">The part the gurus don't want you to read.</p>
              <button className="unlock-btn" onClick={onUnlock} disabled={loading}>
                {loading ? "Redirecting..." : "Unlock for €19"}
              </button>
            </div>
          </div>
        )}
        <section className="card-section">
          <h3 className="section-label">VERDICT</h3>
          <p className={`verdict-text ${locked ? "blurred" : ""}`}>{data.verdict || "Unlocking..."}</p>
        </section>
        <section className="card-section">
          <h3 className="section-label">WHAT WOULD ACTUALLY WORK INSTEAD</h3>
          <p className={`section-body ${locked ? "blurred" : ""}`}>{data.whatWorks || "Unlocking..."}</p>
        </section>
      </div>
      <div className="card-footer">
        <button className="share-btn" onClick={handleCopy}>
          {copied ? "✓ Link copied" : "Share this analysis"}
        </button>
      </div>
    </div>
  );
}

function LandingHero({ onStart }) {
  return (
    <div className="hero">
      <div className="hero-eyebrow">The BS Detector for AI Money Claims</div>
      <h1 className="hero-title">Cash Or<br />Clout?</h1>
      <p className="hero-sub">
        Paste a TikTok, Instagram or YouTube link — or type the idea yourself.<br />
        We stress-test the claim. Coldly. Precisely. No fluff.
      </p>
      <button className="hero-cta" onClick={onStart}>Analyze an idea →</button>
      <div className="hero-proof">
        <span>Free preview</span>
        <span className="dot">·</span>
        <span>Full verdict €19</span>
        <span className="dot">·</span>
        <span>Results in seconds</span>
      </div>
    </div>
  );
}

function ExampleTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % EXAMPLES.length), 3000);
    return () => clearInterval(t);
  }, []);
  const ex = EXAMPLES[idx];
  return (
    <div className="ticker">
      <span className="ticker-label">TRENDING CLAIM</span>
      <span className="ticker-text">"{ex.claim}/month with {ex.idea}" in {ex.time}</span>
    </div>
  );
}

function AdminDashboard({ token }) {
  const [analyses, setAnalyses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${ADMIN_API_URL}?token=${token}`)
      .then(r => r.json())
      .then(data => { if (data.error) throw new Error(data.error); setAnalyses(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) return <div className="loading-wrap"><div className="loading-spinner" /><p className="loading-text">Loading...</p></div>;
  if (error) return <div className="loading-wrap"><p className="loading-text" style={{ color: "var(--red)" }}>{error}</p></div>;
  if (selected) return (
    <div className="result-wrap">
      <div className="admin-bar">
        <span className="admin-badge">ADMIN VIEW</span>
        <button className="new-analysis" onClick={() => setSelected(null)}>← Back to list</button>
      </div>
      <ResultCard data={selected.data} locked={false} />
    </div>
  );

  return (
    <div className="admin-wrap">
      <div className="admin-bar">
        <span className="admin-badge">ADMIN DASHBOARD</span>
        <span className="admin-count">{analyses.length} analyses</span>
      </div>
      <div className="analyses-list">
        {analyses.length === 0 && <p style={{ color: "var(--mid)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>No analyses yet.</p>}
        {analyses.map((a) => (
          <div key={a.id} className="analysis-row" onClick={() => setSelected(a)}>
            <div className="analysis-row-left">
              <span className="analysis-idea">{a.data?.input?.idea || a.data?.input?.videoUrl || "Video analysis"}</span>
              <span className="analysis-claim">{a.data?.input?.claim || ""}</span>
            </div>
            <div className="analysis-row-right">
              <span className={`easy-badge small ${a.data?.isEasy === "Yes" ? "yes" : a.data?.isEasy === "No" ? "no" : "maybe"}`}>{a.data?.isEasy}</span>
              <span className="analysis-date">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyzeForm({ onResult, adminMode }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto"); // auto-detects url vs text
  const [claim, setClaim] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Running the numbers...");

  const inputIsUrl = isUrl(input.trim());

  const handleAnalyze = async () => {
    if (!input.trim()) { setError("Paste a link or describe the idea."); return; }
    if (!inputIsUrl && !claim.trim()) { setError("Add the income claim."); return; }
    setError(""); setLoading(true);

    if (inputIsUrl) {
      setLoadingMsg("Fetching the video... this takes ~30 seconds");
    } else {
      setLoadingMsg("Running the numbers...");
    }

    try {
      const body = inputIsUrl
        ? { videoUrl: input.trim() }
        : { idea: input.trim(), claim: claim.trim(), timeframe: timeframe.trim() };

      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onResult(data, adminMode);
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="loading-wrap">
      <div className="loading-spinner" />
      <p className="loading-text">{loadingMsg}</p>
      <p className="loading-sub">Stress-testing the claim against reality</p>
    </div>
  );

  return (
    <div className="form-wrap">
      <h2 className="form-title">What's the claim?</h2>
      <p className="form-sub">Paste a TikTok, Instagram or YouTube link — or type the idea directly.</p>

      <div className="field">
        <label>{inputIsUrl ? "Video link ✓" : "Link or idea"}</label>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://tiktok.com/... or 'AI content agency'"
        />
      </div>

      {!inputIsUrl && (
        <>
          <div className="field">
            <label>The income claim</label>
            <input value={claim} onChange={e => setClaim(e.target.value)} placeholder="e.g. €10,000/month passive income..." />
          </div>
          <div className="field">
            <label>Timeframe <span className="optional">(optional)</span></label>
            <input value={timeframe} onChange={e => setTimeframe(e.target.value)} placeholder="e.g. 30 days, 3 months..." />
          </div>
        </>
      )}

      {inputIsUrl && (
        <p className="url-note">We'll watch the video and extract the claim automatically.</p>
      )}

      {error && <p className="error">{error}</p>}
      <button className="analyze-btn" onClick={handleAnalyze}>Run the analysis →</button>
      <p className="form-note">Free preview · Full verdict €19</p>
    </div>
  );
}

export default function App() {
  const adminToken = getAdminToken();
  const adminMode = isAdminMode();
  const isAdminPage = window.location.pathname === "/admin";
  const [view, setView] = useState("landing");
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(true);
  const [payLoading, setPayLoading] = useState(false);

  const handleResult = (data, isAdmin) => {
    setResult(data);
    setLocked(!isAdmin);
    setView("result");
  };

  const handleUnlock = async () => {
    setPayLoading(true);
    try {
      const res = await fetch(STRIPE_PAYMENT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId: result?.id }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setPayLoading(false); }
  };

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo" onClick={() => { setView("landing"); window.history.pushState({}, "", "/"); }}>C/C</span>
        <span className="nav-tagline">CashOrClout</span>
        {adminMode && <span className="admin-badge" style={{ marginLeft: "auto" }}>ADMIN</span>}
      </nav>
      <main className="main">
        {isAdminPage && adminToken && <AdminDashboard token={adminToken} />}
        {!isAdminPage && (
          <>
            {view === "landing" && <><ExampleTicker /><LandingHero onStart={() => setView("form")} /></>}
            {view === "form" && <AnalyzeForm onResult={handleResult} adminMode={adminMode} />}
            {view === "result" && result && (
              <div className="result-wrap">
                <ResultCard data={result} locked={locked} onUnlock={handleUnlock} loading={payLoading} />
                <button className="new-analysis" onClick={() => setView("form")}>← Analyze another idea</button>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <span>© 2025 CashOrClout</span><span className="dot">·</span><span>We don't sell dreams. We sell clarity.</span>
      </footer>
    </div>
  );
}
