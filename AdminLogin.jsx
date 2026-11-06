import React from "react";
import { ethers } from "ethers";
import CampaignForm from "./CampaignForm.jsx";

function formatEth(value) {
  return Number(ethers.formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AdminLogin({
  account,
  adminAddress,
  campaigns,
  error,
  busy,
  onBack,
  onLogin,
  onLogout,
  notifications,
  showForm,
  form,
  onFormChange,
  onCreateProject,
  onCreateCampaign,
  onCancelCreate,
  actionError,
  busyAction,
  notice,
}) {
  const totalRaised = campaigns.reduce(
    (total, campaign) => total + campaign.totalRaised,
    0n,
  );
  const activeCampaigns = campaigns.filter((campaign) => campaign.state === 1).length;

  return (
    <main className="admin-shell">
      <section className="admin-card">
        <aside className="admin-aside">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); onBack(); }}>
            <span className="brand-mark">M</span>
            <span>milestone<span className="brand-dot">.</span></span>
          </a>
          <div className="admin-aside-copy">
            <span className="eyebrow"><span /> PLATFORM CONTROL</span>
            <h1>Good work<br />starts with <span>trust.</span></h1>
            <p>Manage the community platform with the wallet configured for this local demo.</p>
          </div>
          <span className="admin-aside-footer"><span className="online-dot" /> Local Hardhat network</span>
        </aside>

        <div className="admin-main">
          <button className="admin-back-link" type="button" onClick={onBack}>← Back to login options</button>
          {account ? (
            <div className="admin-dashboard">
              <span className="admin-icon" aria-hidden="true">✓</span>
              <span className="eyebrow"><span /> ADMIN ACCESS VERIFIED</span>
              <h2>Welcome back.</h2>
              <p className="admin-intro">Connected as <strong>{account}</strong></p>
              <div className="admin-stats">
                <div><strong>{campaigns.length}</strong><span>Total campaigns</span></div>
                <div><strong>{activeCampaigns}</strong><span>Active campaigns</span></div>
                <div><strong>{formatEth(totalRaised)} ETH</strong><span>Total raised</span></div>
              </div>
              {notice && <div className="feedback feedback-success" role="status">{notice}</div>}
              <button className="button button-primary admin-create-button" type="button" onClick={onCreateProject}>＋ Create a project</button>
              {showForm ? (
                <CampaignForm
                  form={form}
                  onChange={onFormChange}
                  onSubmit={onCreateCampaign}
                  onCancel={onCancelCreate}
                  error={actionError}
                  busy={busyAction}
                />
              ) : (
                <section className="admin-notifications" aria-label="User activity notifications">
                  <div className="admin-notifications-heading">
                    <h3>User activity</h3>
                    <span className="notification-live"><span className="online-dot" /> Live</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="admin-notifications-empty">No user acceptances yet. New activity from the blockchain will appear here.</p>
                  ) : (
                    <ul>
                      {notifications.map((notification) => {
                        const campaign = campaigns.find((item) => item.id === notification.campaignId);
                        return (
                          <li key={notification.key}>
                            <span className="notification-icon">{notification.type === "accepted" ? "✓" : "↗"}</span>
                            <span className="notification-copy">
                              <strong>{notification.type === "accepted" ? "Project accepted" : `Contribution · ${formatEth(notification.amount)} ETH`}</strong>
                              <small>{shortenAddress(notification.user)} · {campaign?.title || `Project #${notification.campaignId}`}</small>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {actionError && <p className="admin-notification-error" role="alert">{actionError}</p>}
                </section>
              )}
              <p className="admin-demo-note">Notifications are read from public blockchain events. Admin access in this demo uses a browser-side wallet check; production use requires server-side authorization.</p>
              <button className="button button-secondary" type="button" onClick={onLogout}>Sign out</button>
            </div>
          ) : (
            <div className="admin-login">
              <span className="admin-icon" aria-hidden="true">M</span>
              <span className="eyebrow"><span /> ADMINISTRATOR SIGN IN</span>
              <h2>Welcome back.</h2>
              <p className="admin-intro">Connect the authorized administrator wallet to continue.</p>
              {error && <div className="feedback feedback-error" role="alert">{error}</div>}
              <button className="button button-primary admin-submit" type="button" onClick={onLogin} disabled={busy}>
                {busy ? "Verifying wallet…" : "Connect admin wallet"}
              </button>
              <p className="admin-demo-note">
                Local demo access is limited to the deployer wallet. This browser-only check is for demonstration and does not provide production-grade authentication.
              </p>
              {adminAddress && <p className="admin-wallet-hint">Authorized wallet: <strong>{adminAddress}</strong></p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
