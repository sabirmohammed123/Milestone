// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Milestone-Based Decentralized Crowdfunding Platform
 * @notice Uses backer voting to release escrow funds after each milestone.
 */
contract CrowdfundingPlatform {

    enum CampaignState { Fundraising, Active, Completed, Failed }
    enum MilestoneState { Pending, Voting, Approved, Rejected }

    address public immutable admin;

    struct Milestone {
        string description;
        string ipfsProofHash; // IPFS URI for progress report/proof
        uint256 amountToRelease;
        uint256 approvalVotes;
        uint256 rejectionVotes;
        MilestoneState state;
        bool fundsReleased;
    }

    struct Campaign {
        address payable creator;
        string title;
        string descriptionHash; // IPFS URI for project details
        uint256 goalAmount;
        uint256 totalRaised;
        uint256 deadline;
        uint256 currentMilestoneIndex;
        CampaignState state;
        uint256 totalMilestones;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) public campaignMilestones;
    
    // campaignId => backerAddress => amountContributed
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // campaignId => userAddress => hasAccepted
    mapping(uint256 => mapping(address => bool)) public hasAcceptedCampaign;

    // campaignId => milestoneIndex => voterAddress => hasVoted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVotedOnMilestone;

    // Events
    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goalAmount, uint256 deadline);
    event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event CampaignAccepted(uint256 indexed campaignId, address indexed user);
    event MilestoneSubmitted(uint256 indexed campaignId, uint256 indexed milestoneIndex, string ipfsProofHash);
    event VoteCast(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed voter, bool approve, uint256 weight);
    event MilestoneApproved(uint256 indexed campaignId, uint256 indexed milestoneIndex, uint256 amountReleased);
    event CampaignFailed(uint256 indexed campaignId);
    event RefundClaimed(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can create campaigns");
        _;
    }

    modifier onlyCreator(uint256 _campaignId) {
        require(msg.sender == campaigns[_campaignId].creator, "Only campaign creator can call this");
        _;
    }

    modifier onlyContributor(uint256 _campaignId) {
        require(contributions[_campaignId][msg.sender] > 0, "Only contributors can execute this");
        _;
    }

    /**
     * @notice Creates a new crowdfunding campaign with predefined milestones.
     */
    function createCampaign(
        string memory _title,
        string memory _descriptionHash,
        uint256 _goalAmount,
        uint256 _durationInDays,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external onlyAdmin {
        require(_goalAmount > 0, "Goal must be greater than zero");
        require(_milestoneDescriptions.length == _milestoneAmounts.length, "Milestone arrays length mismatch");
        require(_milestoneDescriptions.length > 0, "At least one milestone required");

        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            totalMilestoneAmount += _milestoneAmounts[i];
        }
        require(totalMilestoneAmount == _goalAmount, "Milestone sum must equal goal amount");

        campaignCount++;
        uint256 newCampaignId = campaignCount;

        campaigns[newCampaignId] = Campaign({
            creator: payable(msg.sender),
            title: _title,
            descriptionHash: _descriptionHash,
            goalAmount: _goalAmount,
            totalRaised: 0,
            deadline: block.timestamp + (_durationInDays * 1 days),
            currentMilestoneIndex: 0,
            state: CampaignState.Fundraising,
            totalMilestones: _milestoneDescriptions.length
        });

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            campaignMilestones[newCampaignId].push(Milestone({
                description: _milestoneDescriptions[i],
                ipfsProofHash: "",
                amountToRelease: _milestoneAmounts[i],
                approvalVotes: 0,
                rejectionVotes: 0,
                state: MilestoneState.Pending,
                fundsReleased: false
            }));
        }

        emit CampaignCreated(newCampaignId, msg.sender, _goalAmount, campaigns[newCampaignId].deadline);
    }

    /**
     * @notice Records a user's interest in an admin-created campaign.
     */
    function acceptCampaign(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.creator != address(0), "Campaign does not exist");
        require(
            campaign.state == CampaignState.Fundraising || campaign.state == CampaignState.Active,
            "Campaign is not accepting users"
        );
        require(!hasAcceptedCampaign[_campaignId][msg.sender], "Campaign already accepted");

        hasAcceptedCampaign[_campaignId][msg.sender] = true;
        emit CampaignAccepted(_campaignId, msg.sender);
    }

    /**
     * @notice Allows backers to fund a campaign before the deadline.
     */
    function contribute(uint256 _campaignId) external payable {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp < campaign.deadline, "Campaign deadline passed");
        require(campaign.state == CampaignState.Fundraising, "Campaign is not accepting funds");
        require(hasAcceptedCampaign[_campaignId][msg.sender], "Accept campaign before contributing");
        require(msg.value > 0, "Contribution must be greater than 0");

        campaign.totalRaised += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;

        emit ContributionReceived(_campaignId, msg.sender, msg.value);

        if (campaign.totalRaised >= campaign.goalAmount) {
            campaign.state = CampaignState.Active;
        }
    }

    /**
     * @notice Creator submits proof for the current milestone to trigger voting.
     */
    function submitMilestoneProof(uint256 _campaignId, string memory _ipfsProofHash) external onlyCreator(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.state == CampaignState.Active, "Campaign is not active");

        uint256 currentIdx = campaign.currentMilestoneIndex;
        Milestone storage currentMilestone = campaignMilestones[_campaignId][currentIdx];

        require(currentMilestone.state == MilestoneState.Pending, "Milestone is not pending proof");

        currentMilestone.ipfsProofHash = _ipfsProofHash;
        currentMilestone.state = MilestoneState.Voting;

        emit MilestoneSubmitted(_campaignId, currentIdx, _ipfsProofHash);
    }

    /**
     * @notice Backers vote on the current milestone based on their contribution weight.
     */
    function voteOnMilestone(uint256 _campaignId, bool _approve) external onlyContributor(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.state == CampaignState.Active, "Campaign is not active");

        uint256 currentIdx = campaign.currentMilestoneIndex;
        Milestone storage currentMilestone = campaignMilestones[_campaignId][currentIdx];

        require(currentMilestone.state == MilestoneState.Voting, "Milestone is not in voting state");
        require(!hasVotedOnMilestone[_campaignId][currentIdx][msg.sender], "Already voted on this milestone");

        uint256 voterWeight = contributions[_campaignId][msg.sender];
        hasVotedOnMilestone[_campaignId][currentIdx][msg.sender] = true;

        if (_approve) {
            currentMilestone.approvalVotes += voterWeight;
        } else {
            currentMilestone.rejectionVotes += voterWeight;
        }

        emit VoteCast(_campaignId, currentIdx, msg.sender, _approve, voterWeight);

        // Check if consensus threshold reached (>50% of total raised)
        uint256 majorityThreshold = campaign.totalRaised / 2;

        if (currentMilestone.approvalVotes > majorityThreshold) {
            currentMilestone.state = MilestoneState.Approved;
            currentMilestone.fundsReleased = true;
            
            payable(campaign.creator).transfer(currentMilestone.amountToRelease);
            emit MilestoneApproved(_campaignId, currentIdx, currentMilestone.amountToRelease);

            campaign.currentMilestoneIndex++;
            if (campaign.currentMilestoneIndex == campaign.totalMilestones) {
                campaign.state = CampaignState.Completed;
            }
        } else if (currentMilestone.rejectionVotes >= majorityThreshold) {
            currentMilestone.state = MilestoneState.Rejected;
            campaign.state = CampaignState.Failed;
            emit CampaignFailed(_campaignId);
        }
    }

    /**
     * @notice Allows backers to claim back their remaining funds if the campaign fails or misses goal.
     */
    function claimRefund(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        
        bool missedGoal = (block.timestamp >= campaign.deadline && campaign.state == CampaignState.Fundraising);
        bool failedGovernance = (campaign.state == CampaignState.Failed);

        require(missedGoal || failedGovernance, "Campaign is not eligible for refunds");

        uint256 contributedAmount = contributions[_campaignId][msg.sender];
        require(contributedAmount > 0, "No contributions to refund");

        contributions[_campaignId][msg.sender] = 0;
        
        uint256 refundAmount;
        if (missedGoal) {
            refundAmount = contributedAmount;
        } else {
            // Refund pro-rata share of remaining contract balance for this campaign
            uint256 remainingBalance = address(this).balance;
            refundAmount = (contributedAmount * remainingBalance) / campaign.totalRaised;
        }

        payable(msg.sender).transfer(refundAmount);
        emit RefundClaimed(_campaignId, msg.sender, refundAmount);
    }

    /**
     * @notice Helper to fetch all milestones for a campaign
     */
    function getMilestones(uint256 _campaignId) external view returns (Milestone[] memory) {
        return campaignMilestones[_campaignId];
    }
}
