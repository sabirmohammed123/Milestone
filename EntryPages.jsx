import React from "react";

export function LoginChoicePage({ onUserLogin, onAdminLogin }) {
  return (
    <main className="entry-shell">
      <section className="entry-card">
        <aside className="entry-aside">
          <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
            <span className="brand-mark">M</span>
            <span>milestone<span className="brand-dot">.</span></span>
          </a>
          <div className="entry-aside-copy">
            <span className="eyebrow"><span /> BACK IDEAS. SEE RESULTS.</span>
            <h1>Make good<br />ideas <span>happen.</span></h1>
            <p>Explore community projects, accept an idea, and follow its progress milestone by milestone.</p>
          </div>
          <span className="admin-aside-footer"><span className="online-dot" /> Local Hardhat demo</span>
        </aside>

        <div className="entry-main">
          <div className="entry-content">
            <span className="eyebrow"><span /> CHOOSE YOUR ACCOUNT</span>
            <h2>Sign in to continue.</h2>
            <p className="admin-intro">Choose the account type you want to use.</p>
            <button className="login-choice-button" type="button" onClick={onUserLogin}>
              <span className="login-choice-icon" aria-hidden="true">↗</span>
              <span><strong>User Login</strong><small>Create projects and support campaigns</small></span>
              <span className="login-choice-arrow" aria-hidden="true">→</span>
            </button>
            <button className="login-choice-button" type="button" onClick={onAdminLogin}>
              <span className="login-choice-icon login-choice-admin" aria-hidden="true">M</span>
              <span><strong>Admin Login</strong><small>Access the administrator dashboard</small></span>
              <span className="login-choice-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoginPage({
  error,
  busy,
  localAccountIndex,
  onLocalAccountChange,
  onLogin,
  onBack,
}) {
  return (
    <main className="entry-shell">
      <section className="entry-card">
        <aside className="entry-aside">
          <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
            <span className="brand-mark">M</span>
            <span>milestone<span className="brand-dot">.</span></span>
          </a>
          <div className="entry-aside-copy">
            <span className="eyebrow"><span /> BACK IDEAS. SEE RESULTS.</span>
            <h1>Make good<br />ideas <span>happen.</span></h1>
            <p>Create a campaign, back a project, and follow its progress milestone by milestone.</p>
          </div>
          <span className="admin-aside-footer"><span className="online-dot" /> Local Hardhat demo</span>
        </aside>

        <div className="entry-main">
          <div className="entry-content">
            <span className="admin-icon" aria-hidden="true">↗</span>
            <span className="eyebrow"><span /> SIGN IN TO CONTINUE</span>
            <h2>Welcome to milestone.</h2>
            <p className="admin-intro">Connect your wallet to accept a project and support it with a contribution.</p>
            {error && <div className="feedback feedback-error" role="alert">{error}</div>}
            {!window.ethereum && (
              <label className="local-account-label">
                Local demo user
                <select
                  className="local-account-select"
                  value={localAccountIndex}
                  onChange={(event) => onLocalAccountChange(Number(event.target.value))}
                >
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((accountNumber) => (
                    <option key={accountNumber} value={accountNumber}>Demo user {accountNumber}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="button button-primary admin-submit" type="button" onClick={onLogin} disabled={busy}>
              {busy ? "Connecting wallet…" : window.ethereum ? "Continue with wallet" : "Continue as demo user"}
            </button>
            <p className="entry-demo-note">
              Local demo users have separate test wallets. Demo funds are not real cryptocurrency.
            </p>
            <button className="entry-admin-link" type="button" onClick={onBack}>← Choose a different login</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export function WelcomePage({ onExplore }) {
  return (
    <main className="entry-shell">
      <section className="welcome-card">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">M</span>
          <span>milestone<span className="brand-dot">.</span></span>
        </a>
        <span className="admin-icon welcome-icon" aria-hidden="true">✓</span>
        <span className="eyebrow"><span /> YOU’RE SIGNED IN</span>
        <h1>What would you like<br />to make <span>happen?</span></h1>
        <p className="welcome-description">Browse admin-published projects, accept the ones you support, and contribute if you choose.</p>
        <div className="welcome-actions">
          <button className="button button-primary" type="button" onClick={onExplore}>Explore projects</button>
        </div>
      </section>
    </main>
  );
}
