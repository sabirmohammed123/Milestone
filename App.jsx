import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import AdminLogin from "./AdminLogin.jsx";
import CampaignForm from "./CampaignForm.jsx";
import { LoginChoicePage, LoginPage, WelcomePage } from "./EntryPages.jsx";
import "./App.css";

const CONTRACT_ABI = [
  "function createCampaign(string _title, string _descriptionHash, uint256 _goalAmount, uint256 _durationInDays, string[] _milestoneDescriptions, uint256[] _milestoneAmounts) external",
  "function acceptCampaign(uint256 _campaignId) external",
  "function contribute(uint256 _campaignId) external payable",
  "function submitMilestoneProof(uint256 _campaignId, string _ipfsProofHash) external",
  "function voteOnMilestone(uint256 _campaignId, bool _approve) external",
  "function claimRefund(uint256 _campaignId) external",
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address creator, string title, string descriptionHash, uint256 goalAmount, uint256 totalRaised, uint256 deadline, uint256 currentMilestoneIndex, uint8 state, uint256 totalMilestones)",
  "function getMilestones(uint256 _campaignId) view returns (tuple(string description, string ipfsProofHash, uint256 amountToRelease, uint256 approvalVotes, uint256 rejectionVotes, uint8 state, bool fundsReleased)[])",
  "function contributions(uint256 campaignId, address backer) view returns (uint256)",
  "function hasAcceptedCampaign(uint256 campaignId, address user) view returns (bool)",
  "function hasVotedOnMilestone(uint256 campaignId, uint256 milestoneIndex, address voter) view returns (bool)",
  "event CampaignAccepted(uint256 indexed campaignId, address indexed user)",
  "event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount)",
];

const CAMPAIGN_STATES = ["Fundraising", "Active", "Completed", "Failed"];
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

function formatEth(value, maximumFractionDigits = 2) {
  return Number(ethers.formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits,
  });
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [networkName, setNetworkName] = useState("Connecting");
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [userLoginSelected, setUserLoginSelected] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [demoAccountIndex, setDemoAccountIndex] = useState(1);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminAccount, setAdminAccount] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");
  const [adminNotificationError, setAdminNotificationError] = useState("");
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [contributionAmounts, setContributionAmounts] = useState({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    goal: "",
    duration: "30",
    milestones: "",
  });

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const adminAddress = import.meta.env.VITE_ADMIN_ADDRESS;

  const loadCampaigns = useCallback(async (activeContract, viewerAddress = "") => {
    setLoading(true);
    try {
      const count = Number(await activeContract.campaignCount());
      const items = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const id = index + 1;
          const [campaign, milestones] = await Promise.all([
            activeContract.campaigns(id),
            activeContract.getMilestones(id),
          ]);
          const accepted = viewerAddress
            ? await activeContract.hasAcceptedCampaign(id, viewerAddress)
            : false;
          return {
            id,
            creator: campaign.creator,
            title: campaign.title,
            descriptionHash: campaign.descriptionHash,
            goalAmount: campaign.goalAmount,
            totalRaised: campaign.totalRaised,
            deadline: campaign.deadline,
            currentMilestoneIndex: Number(campaign.currentMilestoneIndex),
            state: Number(campaign.state),
            accepted,
            milestones: milestones.map((milestone) => ({
              description: milestone.description,
              ipfsProofHash: milestone.ipfsProofHash,
              amountToRelease: milestone.amountToRelease,
              approvalVotes: milestone.approvalVotes,
              rejectionVotes: milestone.rejectionVotes,
              state: Number(milestone.state),
              fundsReleased: milestone.fundsReleased,
            })),
          };
        }),
      );
      setCampaigns(items.reverse());
      setError("");
    } catch (loadError) {
      console.error("Could not load campaigns", loadError);
      setError("Could not load campaigns from the local blockchain.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminNotifications = useCallback(async (activeContract) => {
    try {
      const [acceptances, contributions] = await Promise.all([
        activeContract.queryFilter(activeContract.filters.CampaignAccepted()),
        activeContract.queryFilter(activeContract.filters.ContributionReceived()),
      ]);
      const items = [
        ...acceptances.map((event) => ({
          key: `${event.transactionHash}-${event.index}`,
          campaignId: Number(event.args.campaignId),
          user: event.args.user,
          type: "accepted",
          blockNumber: event.blockNumber,
        })),
        ...contributions.map((event) => ({
          key: `${event.transactionHash}-${event.index}`,
          campaignId: Number(event.args.campaignId),
          user: event.args.contributor,
          amount: event.args.amount,
          type: "contributed",
          blockNumber: event.blockNumber,
        })),
      ];
      items.sort((left, right) => right.blockNumber - left.blockNumber);
      setAdminNotifications(items.slice(0, 30));
      setAdminNotificationError("");
    } catch (notificationError) {
      console.error("Could not load admin activity notifications", notificationError);
      setAdminNotificationError("Could not load user activity notifications from the blockchain.");
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!contractAddress) {
      setError("Contract address is missing. Start the local demo with npm run demo.");
      setLoading(false);
      return;
    }

    try {
      let activeProvider;
      let signer;
      let name;

      if (window.ethereum) {
        activeProvider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await activeProvider.send("eth_accounts", []);
        if (accounts.length > 0) {
          signer = await activeProvider.getSigner();
          name = "MetaMask";
        }
      }

      if (!signer) {
        activeProvider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
        signer = await activeProvider.getSigner(0);
        name = "Local Hardhat";
      }

      const address = await signer.getAddress();
      const chain = await activeProvider.getNetwork();
      const activeContract = new ethers.Contract(
        contractAddress,
        CONTRACT_ABI,
        signer,
      );
      setAccount(address);
      setContract(activeContract);
      setNetworkName(
        Number(chain.chainId) === 31337 ? name : `${name} · chain ${chain.chainId}`,
      );
      await loadCampaigns(activeContract, address);
    } catch (connectionError) {
      console.error("Wallet connection failed", connectionError);
      setError(
        "Could not connect to the local blockchain. Run npm run demo and try again.",
      );
      setLoading(false);
    }
  }, [contractAddress, loadCampaigns]);

  useEffect(() => {
    connectWallet();
  }, [connectWallet]);

  async function loginUser() {
    setLoginBusy(true);
    setLoginError("");
    try {
      if (!contractAddress) {
        throw new Error("The demo contract is not configured. Start the app with npm run dev.");
      }

      let provider;
      let signer;
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const chain = await provider.getNetwork();
        if (Number(chain.chainId) !== 31337) {
          throw new Error("Switch your wallet to the local Hardhat network (chain ID 31337).");
        }
        signer = await provider.getSigner();
      } else {
        provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
        signer = await provider.getSigner(demoAccountIndex);
      }

      const address = await signer.getAddress();
      const activeContract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
      setAccount(address);
      setContract(activeContract);
      setNetworkName(window.ethereum ? "MetaMask" : "Local Hardhat demo");
      setUserLoggedIn(true);
      setShowWelcome(true);
      await loadCampaigns(activeContract, address);
    } catch (loginError) {
      console.error("User wallet sign-in failed", loginError);
      setLoginError(
        loginError?.shortMessage ||
          loginError?.message ||
          "Could not connect your wallet. Please try again.",
      );
    } finally {
      setLoginBusy(false);
    }
  }

  function signOutUser() {
    setUserLoggedIn(false);
    setShowWelcome(false);
    setLoginError("");
  }

  async function connectMetaMask() {
    if (!window.ethereum) {
      setError("MetaMask was not found. You can still use the local demo wallet.");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await connectWallet();
    } catch (connectionError) {
      console.error("MetaMask connection failed", connectionError);
      setError("MetaMask connection was not approved.");
    }
  }

  async function loginAdmin() {
    setAdminBusy(true);
    setAdminError("");
    try {
      if (!adminAddress) {
        throw new Error("Admin wallet is not configured. Restart the demo with npm run dev.");
      }

      let provider;
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
      } else {
        provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
      }

      const chain = await provider.getNetwork();
      if (Number(chain.chainId) !== 31337) {
        throw new Error("Switch your wallet to the local Hardhat network (chain ID 31337).");
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      if (address.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error("This wallet is not authorized as the demo administrator.");
      }
      const activeContract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
      setAccount(address);
      setContract(activeContract);
      setNetworkName("Local Hardhat admin");
      setAdminAccount(address);
      setShowAdminForm(false);
      await Promise.all([
        loadCampaigns(activeContract, address),
        loadAdminNotifications(activeContract),
      ]);
    } catch (loginError) {
      console.error("Admin login failed", loginError);
      setAdminError(
        loginError?.shortMessage ||
          loginError?.message ||
          "Could not verify the administrator wallet.",
      );
    } finally {
      setAdminBusy(false);
    }
  }

  useEffect(() => {
    if (!adminAccount || !contract) return undefined;
    const timer = window.setInterval(() => {
      loadAdminNotifications(contract);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [adminAccount, contract, loadAdminNotifications]);

  useEffect(() => {
    if (!userLoggedIn || adminAccount || !contract) return undefined;
    const timer = window.setInterval(() => {
      loadCampaigns(contract, account);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [userLoggedIn, adminAccount, contract, account, loadCampaigns]);

  async function sendTransaction(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const transaction = await action();
      await transaction.wait();
      setNotice(successMessage);
      await loadCampaigns(contract, account);
    } catch (transactionError) {
      console.error("Transaction failed", transactionError);
      setError(
        transactionError?.shortMessage ||
          transactionError?.reason ||
          "The transaction failed. Check the wallet and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function acceptCampaign(campaignId) {
    if (!contract || !account) return;
    await sendTransaction(
      () => contract.acceptCampaign(campaignId),
      "You accepted this project. The admin has been notified.",
    );
    if (adminAccount) await loadAdminNotifications(contract);
  }

  async function createCampaign(event) {
    event.preventDefault();
    if (!contract || !adminAccount) {
      setAdminActionError("Only the signed-in administrator can publish projects.");
      return;
    }
    const setCampaignError = adminAccount ? setAdminActionError : setError;

    const descriptions = form.milestones
      .split(",")
      .map((milestone) => milestone.trim())
      .filter(Boolean);
    if (descriptions.length === 0) {
      setCampaignError("Add at least one milestone.");
      return;
    }

    let goalAmount;
    try {
      goalAmount = ethers.parseEther(form.goal);
    } catch {
      setCampaignError("Enter a valid campaign goal in ETH.");
      return;
    }

    const installment = goalAmount / BigInt(descriptions.length);
    if (installment === 0n) {
      setCampaignError("The goal must be large enough to fund every milestone.");
      return;
    }
    const amounts = descriptions.map((_, index) =>
      index === descriptions.length - 1
        ? goalAmount - installment * BigInt(descriptions.length - 1)
        : installment,
    );

    setBusy(true);
    setCampaignError("");
    try {
      const transaction = await contract.createCampaign(
        form.title.trim(),
        form.description.trim(),
        goalAmount,
        BigInt(form.duration),
        descriptions,
        amounts,
      );
      await transaction.wait();
      setNotice("Your project is published and visible to all users.");
      setForm({
        title: "",
        description: "",
        goal: "",
        duration: "30",
        milestones: "",
      });
      setShowAdminForm(false);
      await loadCampaigns(contract, account);
    } catch (transactionError) {
      console.error("Campaign creation failed", transactionError);
      setCampaignError(
        transactionError?.shortMessage ||
          transactionError?.reason ||
          "Could not create this campaign.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function contribute(campaignId) {
    if (!contract || !account) return;
    let amount;
    try {
      amount = ethers.parseEther(contributionAmounts[campaignId] || "");
    } catch {
      setError("Enter a valid contribution amount in ETH.");
      return;
    }
    if (amount <= 0n) {
      setError("A contribution must be greater than zero.");
      return;
    }
    await sendTransaction(
      () => contract.contribute(campaignId, { value: amount }),
      "Your contribution is confirmed on the blockchain.",
    );
    setContributionAmounts((current) => ({ ...current, [campaignId]: "" }));
  }

  const activeCampaigns = campaigns.filter((campaign) => campaign.state === 1);
  const totalRaised = campaigns.reduce(
    (total, campaign) => total + campaign.totalRaised,
    0n,
  );

  if (showAdmin) {
    return (
      <AdminLogin
        account={adminAccount}
        adminAddress={adminAddress}
        campaigns={campaigns}
        error={adminError}
        busy={adminBusy}
        notifications={adminNotifications}
        showForm={showAdminForm}
        form={form}
        onFormChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
        onCreateProject={() => {
          setAdminActionError("");
          setShowAdminForm(true);
        }}
        onCreateCampaign={createCampaign}
        onCancelCreate={() => setShowAdminForm(false)}
        actionError={showAdminForm ? adminActionError : adminNotificationError || adminActionError}
        busyAction={busy}
        notice={notice}
        onBack={() => {
          setAdminAccount("");
          setShowAdminForm(false);
          setShowAdmin(false);
        }}
        onLogin={loginAdmin}
        onLogout={() => {
          setAdminAccount("");
          setShowAdminForm(false);
          setAdminNotifications([]);
          setUserLoggedIn(false);
          setUserLoginSelected(false);
        }}
      />
    );
  }

  if (!userLoggedIn) {
    if (!userLoginSelected) {
      return (
        <LoginChoicePage
          onUserLogin={() => {
            setLoginError("");
            setUserLoginSelected(true);
          }}
          onAdminLogin={() => {
            setAdminError("");
            setAdminAccount("");
            setShowAdmin(true);
          }}
        />
      );
    }

    return (
      <LoginPage
        error={loginError}
        busy={loginBusy}
        localAccountIndex={demoAccountIndex}
        onLocalAccountChange={setDemoAccountIndex}
        onLogin={loginUser}
        onBack={() => setUserLoginSelected(false)}
      />
    );
  }

  if (showWelcome) {
    return (
      <WelcomePage
        onExplore={() => setShowWelcome(false)}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Milestone home">
          <span className="brand-mark">M</span>
          <span>milestone<span className="brand-dot">.</span></span>
        </a>
        <nav className="topbar-links" aria-label="Main navigation">
          <a href="#campaigns">Explore</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="wallet-area">
          {adminAccount ? (
            <button className="admin-nav-button" type="button" onClick={() => setShowAdmin(true)}>Admin dashboard</button>
          ) : null}
          <span className="network-pill"><span className="online-dot" />{networkName}</span>
          {account ? (
            <button className="wallet-button" type="button" onClick={connectMetaMask}>
              <span className="wallet-dot" />
              {shortenAddress(account)}
              <span className="wallet-chevron">⌄</span>
            </button>
          ) : (
            <button className="wallet-button" type="button" onClick={connectMetaMask}>
              Connect wallet
            </button>
          )}
          <button className="signout-button" type="button" onClick={adminAccount ? () => {
            setAdminAccount("");
            signOutUser();
          } : signOutUser}>Sign out</button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span /> BACK IDEAS. SEE RESULTS.</div>
          <h1>Good ideas deserve<br />to <span>make it.</span></h1>
          <p className="hero-description">
            Fund the next big thing, one milestone at a time. Your money stays
            protected until the work gets done.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#campaigns">
              Explore projects <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-secondary" href="#how-it-works">
              See how it works
            </a>
          </div>
          <div className="social-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>J</span><span>A</span><span>M</span><span>S</span>
            </div>
            <span>Backed by <strong>early believers</strong></span>
          </div>
        </div>

        <div className="hero-art" aria-label="Illustration of a growing community campaign">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-card card-back"><span>✓</span><span>PROGRESS VERIFIED</span></div>
          <div className="art-plant plant-left"><i /><i /><i /><b /></div>
          <div className="art-plant plant-right"><i /><i /><i /><b /></div>
          <div className="art-ground" />
          <div className="art-progress-card">
            <div className="progress-card-top"><span className="tiny-icon">↗</span><span>CAMPAIGN UPDATE</span><span className="live-label">LIVE</span></div>
            <div className="art-card-title">A brighter kind<br />of energy.</div>
            <div className="art-progress-meta"><span>72% funded</span><span>01 / 03</span></div>
            <div className="art-progress-track"><span /></div>
            <div className="art-avatars"><i>J</i><i>A</i><i>M</i><span>+128 backers</span></div>
          </div>
          <div className="art-floating floating-left">✳ &nbsp;Built on trust</div>
          <div className="art-floating floating-right"><span>●</span> funds protected</div>
        </div>
      </section>

      <section className="stats-bar" aria-label="Platform statistics">
        <div className="stat"><strong>{campaigns.length.toString().padStart(2, "0")}</strong><span>Projects launched</span></div>
        <div className="stat"><strong>{formatEth(totalRaised)} <i>ETH</i></strong><span>Raised by the community</span></div>
        <div className="stat"><strong>{activeCampaigns.length.toString().padStart(2, "0")}</strong><span>Active right now</span></div>
        <div className="trust-stat"><span className="shield-icon">✓</span><span><strong>Milestone protected</strong><small>Funds released as work gets done</small></span></div>
      </section>

      <section className="campaign-section" id="campaigns">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span /> THE GOOD STUFF</div>
            <h2>Projects worth<br className="mobile-break" /> believing in<span>.</span></h2>
          </div>
          {adminAccount && (
            <button className="button button-primary start-button" onClick={() => {
              setShowAdmin(true);
              setShowAdminForm(true);
            }}>＋ Create a project</button>
          )}
        </div>

        {error && <div className="feedback feedback-error" role="alert">{error}</div>}
        {notice && <div className="feedback feedback-success" role="status">{notice}</div>}

        <div className="campaign-grid">
          {loading && campaigns.length === 0 && (
            <div className="empty-state"><div className="loader" /><h3>Finding the good ideas…</h3><p>Reading the latest projects from the local blockchain.</p></div>
          )}
          {!loading && campaigns.length === 0 && (
            <div className="empty-state"><span className="empty-icon">✳</span><h3>A new idea is on its way.</h3><p>Admin-created projects will appear here for everyone to explore.</p></div>
          )}
          {campaigns.map((campaign, index) => {
            const percent = Math.min(
              100,
              Number((campaign.totalRaised * 100n) / campaign.goalAmount),
            );
            const milestone = campaign.milestones[campaign.currentMilestoneIndex];
            const voted = campaign.state === 1 && milestone?.state === 1;
            return (
              <article className="campaign-card" key={campaign.id}>
                <div className={`campaign-art campaign-art-${index % 3}`}>
                  <span className="category-tag">{campaign.state === 1 ? "✳ &nbsp;MAKING IT HAPPEN" : `✳ &nbsp;${CAMPAIGN_STATES[campaign.state].toUpperCase()}`}</span>
                  <span className="campaign-art-number">0{index + 1}</span>
                  <div className="art-symbol" aria-hidden="true">{index % 3 === 0 ? "↗" : index % 3 === 1 ? "✳" : "◎"}</div>
                </div>
                <div className="campaign-content">
                  <div className="campaign-kicker">COMMUNITY PROJECT <span>#{campaign.id}</span></div>
                  <h3>{campaign.title}</h3>
                  <p className="campaign-description">{campaign.descriptionHash || "A community-funded idea, built with transparency from the first step."}</p>
                  <div className="funding-label"><strong>{formatEth(campaign.totalRaised)} <i>ETH</i></strong><span>of {formatEth(campaign.goalAmount)} ETH</span></div>
                  <div className="funding-track"><span style={{ width: `${percent}%` }} /></div>
                  <div className="funding-foot"><span>{percent}% funded</span><span>{campaign.milestones.length} milestones</span></div>
                  <div className="milestone-current">
                    <span className="milestone-icon">{voted ? "◷" : "✓"}</span>
                    <span className="milestone-copy"><small>{voted ? "CURRENT MILESTONE · VOTING" : "NEXT MILESTONE"}</small><strong>{milestone?.description || "All milestones complete"}</strong></span>
                    <span className="milestone-amount">{milestone ? `${formatEth(milestone.amountToRelease)} ETH` : "✓"}</span>
                  </div>
                  {voted && milestone.ipfsProofHash && <a className="proof-link" href={milestone.ipfsProofHash.startsWith("http") ? milestone.ipfsProofHash : `https://ipfs.io/ipfs/${milestone.ipfsProofHash}`} target="_blank" rel="noreferrer">View milestone proof ↗</a>}
                  {!adminAccount && (campaign.state === 0 || campaign.state === 1) && (
                    <div className="campaign-actions">
                      {campaign.accepted ? (
                        <span className="campaign-accepted" role="status">✓ Accepted · admin notified</span>
                      ) : (
                        <button className="button button-secondary" disabled={busy} onClick={() => acceptCampaign(campaign.id)}>Accept project</button>
                      )}
                    </div>
                  )}
                  {campaign.state === 0 && !adminAccount && campaign.accepted && (
                    <div className="contribute-row">
                      <input aria-label={`Contribution amount for ${campaign.title}`} type="number" min="0.000000000000000001" step="any" placeholder="Amount in ETH" value={contributionAmounts[campaign.id] || ""} onChange={(event) => setContributionAmounts({ ...contributionAmounts, [campaign.id]: event.target.value })} />
                      <button className="button button-primary contribute-button" disabled={busy} onClick={() => contribute(campaign.id)}>Contribute ↗</button>
                    </div>
                  )}
                  {campaign.state === 1 && (
                    <div className="campaign-actions">
                      {voted && (
                        <>
                          <button className="button button-secondary" disabled={busy} onClick={() => sendTransaction(() => contract.voteOnMilestone(campaign.id, true), "Your milestone approval is recorded.")}>Approve</button>
                          <button className="button button-secondary" disabled={busy} onClick={() => sendTransaction(() => contract.voteOnMilestone(campaign.id, false), "Your milestone rejection is recorded.")}>Reject</button>
                        </>
                      )}
                      {account.toLowerCase() === campaign.creator.toLowerCase() && milestone?.state === 0 && (
                        <button className="button button-secondary" disabled={busy} onClick={() => {
                          const proof = window.prompt("Enter a proof link or IPFS hash:");
                          if (proof?.trim()) sendTransaction(() => contract.submitMilestoneProof(campaign.id, proof.trim()), "Milestone proof submitted for backer voting.");
                        }}>Submit milestone proof</button>
                      )}
                    </div>
                  )}
                  {campaign.state === 3 && (
                    <button className="button button-secondary refund-button" disabled={busy} onClick={() => sendTransaction(() => contract.claimRefund(campaign.id), "Your refund has been claimed.")}>Claim your refund</button>
                  )}
                </div>
                <footer className="campaign-footer"><span><span className="creator-dot" /> Created by {shortenAddress(campaign.creator)}</span><span>{CAMPAIGN_STATES[campaign.state]}</span></footer>
              </article>
            );
          })}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="eyebrow"><span /> SIMPLE BY DESIGN</div>
        <h2>A little more trust<br />goes a long way<span>.</span></h2>
        <div className="how-grid">
          <article><span className="how-number">01</span><h3>Ideas get a plan.</h3><p>Every project sets clear milestones, so you know what success looks like before you back it.</p></article>
          <article><span className="how-number">02</span><h3>Believers chip in.</h3><p>Support a project you care about. Your contribution stays in the campaign's smart contract.</p></article>
          <article><span className="how-number">03</span><h3>Progress earns trust.</h3><p>Backers vote on each update. Funds are released only when the community approves the work.</p></article>
        </div>
      </section>

      <footer className="site-footer"><a className="brand" href="#home"><span className="brand-mark">M</span><span>milestone<span className="brand-dot">.</span></span></a><span>Good ideas, built together. <span className="footer-heart">♥</span></span><span className="footer-chain"><span className="online-dot" /> Local blockchain demo</span></footer>
    </main>
  );
}
