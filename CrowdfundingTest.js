const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrowdfundingPlatform Smart Contract", function () {
  let Crowdfunding, crowdfunding;
  let owner, creator, backer1, backer2;

  beforeEach(async function () {
    [owner, creator, backer1, backer2] = await ethers.getSigners();
    Crowdfunding = await ethers.getContractFactory("CrowdfundingPlatform");
    crowdfunding = await Crowdfunding.deploy();
  });

  it("Should create a campaign successfully", async function () {
    const goal = ethers.parseEther("10");
    const milestones = ["Prototype", "Production"];
    const amounts = [ethers.parseEther("4"), ethers.parseEther("6")];

    await crowdfunding.connect(owner).createCampaign(
      "Eco Tech Gadget",
      "QmHashDetails",
      goal,
      30,
      milestones,
      amounts
    );

    const campaign = await crowdfunding.campaigns(1);
    expect(campaign.title).to.equal("Eco Tech Gadget");
    expect(campaign.goalAmount).to.equal(goal);
    expect(campaign.creator).to.equal(owner.address);
  });

  it("Should prevent users from creating admin campaigns", async function () {
    await expect(
      crowdfunding.connect(creator).createCampaign(
        "Unauthorized project",
        "QmHash",
        ethers.parseEther("1"),
        30,
        ["Delivery"],
        [ethers.parseEther("1")]
      )
    ).to.be.revertedWith("Only admin can create campaigns");
  });

  it("Should record a user's acceptance and emit an admin notification event", async function () {
    await crowdfunding.connect(owner).createCampaign(
      "Community Garden",
      "Garden project",
      ethers.parseEther("1"),
      30,
      ["Prepare the land"],
      [ethers.parseEther("1")]
    );

    await expect(crowdfunding.connect(backer1).acceptCampaign(1))
      .to.emit(crowdfunding, "CampaignAccepted")
      .withArgs(1, backer1.address);
    expect(await crowdfunding.hasAcceptedCampaign(1, backer1.address)).to.equal(true);
    await expect(crowdfunding.connect(backer1).acceptCampaign(1))
      .to.be.revertedWith("Campaign already accepted");
  });

  it("Should require users to accept a campaign before contributing", async function () {
    await crowdfunding.connect(owner).createCampaign(
      "Community Garden",
      "Garden project",
      ethers.parseEther("1"),
      30,
      ["Prepare the land"],
      [ethers.parseEther("1")]
    );

    await expect(
      crowdfunding.connect(backer1).contribute(1, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Accept campaign before contributing");
    await crowdfunding.connect(backer1).acceptCampaign(1);
    await expect(
      crowdfunding.connect(backer1).contribute(1, { value: ethers.parseEther("1") })
    ).to.emit(crowdfunding, "ContributionReceived");
  });

  it("Should lock funds and approve milestone based on voting consensus", async function () {
    const goal = ethers.parseEther("10");
    const amounts = [ethers.parseEther("5"), ethers.parseEther("5")];

    await crowdfunding.connect(owner).createCampaign(
      "Solar Bike",
      "QmHash",
      goal,
      10,
      ["M1", "M2"],
      amounts
    );

    // Fund Campaign
    await crowdfunding.connect(backer1).acceptCampaign(1);
    await crowdfunding.connect(backer2).acceptCampaign(1);
    await crowdfunding.connect(backer1).contribute(1, { value: ethers.parseEther("6") });
    await crowdfunding.connect(backer2).contribute(1, { value: ethers.parseEther("4") });

    // Creator submits milestone proof
    await crowdfunding.connect(owner).submitMilestoneProof(1, "QmProof1");

    // Backer1 votes (holds 60% voting weight)
    await expect(crowdfunding.connect(backer1).voteOnMilestone(1, true))
      .to.emit(crowdfunding, "MilestoneApproved");

    const milestones = await crowdfunding.getMilestones(1);
    expect(milestones[0].state).to.equal(2); // Approved State
  });
});