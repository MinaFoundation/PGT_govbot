import { Optional } from 'sequelize';

export interface CoreAttributes {
  id: number;
}

export interface UserAttributes extends CoreAttributes {
  duid: string;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

export interface SMEGroupAttributes extends CoreAttributes{
  id: number;
  name: string;
  description: string;
}

export interface SMEGroupCreationAttributes extends Omit<SMEGroupAttributes, 'id'> {}

export interface SMEGroupMembershipAttributes extends CoreAttributes {
  id: number;
  smeGroupId: number;
  duid: string;
}

export interface SMEGroupMembershipCreationAttributes extends Omit<SMEGroupMembershipAttributes, 'id'> {}


export interface AdminUserAttributes extends CoreAttributes {
  duid: string;
}

export interface AdminUserCreationAttributes extends Optional<AdminUserAttributes, 'id'> {}

export interface UserPublicKeyAttributes extends CoreAttributes {
  duid: string;
  publicKey: string;
}

export interface UserPublicKeyCreationAttributes extends Optional<UserPublicKeyAttributes, 'id'> {}

export interface TopicAttributes extends CoreAttributes {
  name: string;
  description: string;
}

export interface TopicCommitteeCreationAttributes extends Optional<TopicCommitteeAttributes, 'id'> {}

export interface TopicCommitteeWithSMEGroupAttributes extends TopicCommitteeAttributes {
  SMEGroup?: {
    name: string;
  }
}

export interface TopicWithCommitteesAttributes extends TopicAttributes {
  committees?: TopicCommitteeWithSMEGroupAttributes[];
}

export interface TopicCreationAttributes extends Optional<TopicAttributes, 'id'> {}

export interface TopicCommitteeAttributes extends CoreAttributes {
  topicId: number;
  smeGroupId: number;
  numUsers: number;
}

export interface TopicCommitteeCreationAttributes extends Optional<TopicCommitteeAttributes, 'id'> {}

export interface FundingRoundConsiderationVoteAllowedSMEGroupsAttributes extends CoreAttributes {
  fundingRoundId: number;
  smeGroupId: number;
}

export interface FundingRoundConsiderationVoteAllowedSMEGroupsCreationAttributes extends Optional<FundingRoundConsiderationVoteAllowedSMEGroupsAttributes, 'id'> {}

export interface TopicSMEGroupProposalCreationLimiterAttributes extends CoreAttributes {
  topicId: number;
  smeGroupId: number;
}

export interface TopicSMEGroupProposalCreationLimiterCreationAttributes extends Optional<TopicSMEGroupProposalCreationLimiterAttributes, 'id'> {}

export enum FundingRoundStatus {
  VOTING = 'VOTING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface FundingRoundAttributes extends CoreAttributes {
  name: string;
  description: string;
  topicId: number;
  budget: number;
  votingAddress: string | null;
  stakingLedgerEpoch: number;
  status: FundingRoundStatus;
  votingOpenUntil: Date | null;
  forumChannelId: string | null;
  startAt: Date | null;
  endAt: Date | null;
}

export interface FundingRoundCreationAttributes extends Optional<FundingRoundAttributes, 'id' | 'status' | 'votingOpenUntil' | 'startAt' | 'endAt'> {}


export interface FundingRoundPhaseAttributes extends CoreAttributes {
  fundingRoundId: number;
  startAt: Date;
  endAt: Date;
}

export interface FundingRoundPhaseCreationAttributes extends Optional<FundingRoundPhaseAttributes, 'id'> {}

export interface ConsiderationPhaseAttributes extends FundingRoundPhaseAttributes {}
export interface ConsiderationPhaseCreationAttributes extends FundingRoundPhaseCreationAttributes {}

export interface DeliberationPhaseAttributes extends FundingRoundPhaseAttributes {}
export interface DeliberationPhaseCreationAttributes extends FundingRoundPhaseCreationAttributes {}

export interface FundingVotingPhaseAttributes extends FundingRoundPhaseAttributes {}
export interface FundingVotingPhaseCreationAttributes extends FundingRoundPhaseCreationAttributes {}

export enum ProposalStatus {
  DRAFT = 'DRAFT',
  CONSIDERATION_PHASE = 'CONSIDERATION_VOTE',
  DELIBERATION_PHASE = 'DELIBERATION_VOTE',
  FUNDING_VOTING_PHASE = 'FUNDING_VOTE',
  FUNDED = 'FUNDED',  // proposal has made its way throughout all of the round and has beeen funded.  
  CANCELLED = 'CANCELLED',  // proposals that are cancelled by the proposer after being assigned to a FR
}

export interface ProposalAttributes extends CoreAttributes {
  name: string;
  proposerDuid: string;
  budget: number;
  uri: string;
  fundingRoundId: number | null;
  forumThreadId: string | null;
  status: ProposalStatus;
}

export interface ProposalCreationAttributes extends Optional<ProposalAttributes, 'id'> {}

export interface FundingRoundDeliberationCommitteeSelectionAttributes extends CoreAttributes {
  duid: string;
  fundingRoundId: number;
}

export interface FundingRoundDeliberationCommitteeSelectionCreationAttributes extends Optional<FundingRoundDeliberationCommitteeSelectionAttributes, 'id'> {}

export interface VoteLogAttributes extends CoreAttributes {
  duid: string;
}

export interface VoteLogCreationAttributes extends Optional<VoteLogAttributes, 'id'> {}

export interface ProjectVoteLogAttributes extends VoteLogAttributes {
  proposalId: number;
}

export interface ProjectVoteLogCreationAttributes extends Optional<ProjectVoteLogAttributes, 'id'> {}

export interface SMEConsiderationVoteLogAttributes extends ProjectVoteLogAttributes {
  isPass: boolean;
  reason: string | null;
}

export interface SMEConsiderationVoteLogCreationAttributes extends Optional<SMEConsiderationVoteLogAttributes, 'id'> {}

export interface GPTSummarizerVoteLogAttributes extends ProjectVoteLogAttributes {
  why: string;
  reason: string | null;
}

export interface GPTSummarizerVoteLogCreationAttributes extends Optional<GPTSummarizerVoteLogAttributes, 'id'> {}

export enum CommitteeDeliberationVoteChoice {
  APPROVED = 'APPROVED',
  APPROVED_MODIFIED = 'APPROVED_MODIFIED',
  REJECTED = 'REJECTED',
}

export interface CommitteeDeliberationVoteLogAttributes extends ProjectVoteLogAttributes {
  vote: CommitteeDeliberationVoteChoice;
  uri: string;
  reason: string | null;
}

export interface CommitteeDeliberationVoteLogCreationAttributes extends Optional<CommitteeDeliberationVoteLogAttributes, 'id'> {}

export interface CommitteeDeliberationProjectSelectionAttributes extends CoreAttributes {
  proposalId: number;
  fundingRoundId: number;
}

export interface CommitteeDeliberationProjectSelectionCreationAttributes extends Optional<CommitteeDeliberationProjectSelectionAttributes, 'id'> {}

export interface FundingRoundVoteLogAttributes extends VoteLogAttributes {
  fundingRoundId: number;
}

export interface FundingRoundVoteLogCreationAttributes extends Optional<FundingRoundVoteLogAttributes, 'id'> {}

export interface FundingRoundApprovalVoteAttributes extends FundingRoundVoteLogAttributes {
  isPass: boolean;
  reason: string | null;
}

export interface FundingRoundApprovalVoteCreationAttributes extends Optional<FundingRoundApprovalVoteAttributes, 'id'> {}


export type FundingRoundPhase = {
  phase: 'consideration' | 'deliberation' | 'voting'; 
  startDate: Date;
  endDate: Date;
};
