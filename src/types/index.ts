import { Model, Optional } from 'sequelize';

export interface CoreAttributes {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAttributes extends CoreAttributes {
  duid: number;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface SMEGroupAttributes extends CoreAttributes {
  name: string;
  description: string;
}

export interface SMEGroupCreationAttributes extends Optional<SMEGroupAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface AdminUserAttributes extends CoreAttributes {
  duid: number;
}

export interface AdminUserCreationAttributes extends Optional<AdminUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface UserPublicKeyAttributes extends CoreAttributes {
  duid: number;
  publicKey: string;
}

export interface UserPublicKeyCreationAttributes extends Optional<UserPublicKeyAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface TopicAttributes extends CoreAttributes {
  name: string;
  description: string;
}

export interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface TopicCommitteeAttributes extends CoreAttributes {
  topicId: number;
  smeGroupId: number;
  numUsers: number;
}

export interface TopicCommitteeCreationAttributes extends Optional<TopicCommitteeAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FundingRoundConsiderationVoteAllowedSMEGroupsAttributes extends CoreAttributes {
  fundingRoundId: number;
  smeGroupId: number;
}

export interface FundingRoundConsiderationVoteAllowedSMEGroupsCreationAttributes extends Optional<FundingRoundConsiderationVoteAllowedSMEGroupsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface TopicSMEGroupProposalCreationLimiterAttributes extends CoreAttributes {
  topicId: number;
  smeGroupId: number;
}

export interface TopicSMEGroupProposalCreationLimiterCreationAttributes extends Optional<TopicSMEGroupProposalCreationLimiterAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export enum FundingRoundStatus {
  DRAFT = 'VOTING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface FundingRoundAttributes extends CoreAttributes {
  name: string;
  description: string;
  topicId: number;
  budget: number;
  votingAddress: string;
  status: FundingRoundStatus;
  votingOpenUntil: Date;
  startAt: Date;
  endAt: Date;
}

export interface FundingRoundCreationAttributes extends Optional<FundingRoundAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FundingRoundPhaseAttributes extends CoreAttributes {
  fundingRoundId: number;
  startAt: Date;
  endAt: Date;
}

export interface FundingRoundPhaseCreationAttributes extends Optional<FundingRoundPhaseAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

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
}

export interface ProposalAttributes extends CoreAttributes {
  name: string;
  proposerDuid: number;
  budget: number;
  uri: string;
  fundingRoundId: number | null;
  status: ProposalStatus;
}

export interface ProposalCreationAttributes extends Optional<ProposalAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FundingRoundDeliberationCommitteeSelectionAttributes extends CoreAttributes {
  duid: number;
  fundingRoundId: number;
}

export interface FundingRoundDeliberationCommitteeSelectionCreationAttributes extends Optional<FundingRoundDeliberationCommitteeSelectionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface VoteLogAttributes extends CoreAttributes {
  duid: number;
}

export interface VoteLogCreationAttributes extends Optional<VoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface ProjectVoteLogAttributes extends VoteLogAttributes {
  proposalId: number;
}

export interface ProjectVoteLogCreationAttributes extends Optional<ProjectVoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface SMEConsiderationVoteLogAttributes extends ProjectVoteLogAttributes {
  isPass: boolean;
}

export interface SMEConsiderationVoteLogCreationAttributes extends Optional<SMEConsiderationVoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface GPTSummarizerVoteLogAttributes extends ProjectVoteLogAttributes {
  why: string;
}

export interface GPTSummarizerVoteLogCreationAttributes extends Optional<GPTSummarizerVoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export enum CommitteeDeliberationVoteChoice {
  APPROVED = 'APPROVED',
  APPROVED_MODIFIED = 'APPROVED_MODIFIED',
  REJECTED = 'REJECTED',
}

export interface CommitteeDeliberationVoteLogAttributes extends ProjectVoteLogAttributes {
  vote: CommitteeDeliberationVoteChoice;
  uri: string;
}

export interface CommitteeDeliberationVoteLogCreationAttributes extends Optional<CommitteeDeliberationVoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface CommitteeDeliberationProjectSelectionAttributes extends CoreAttributes {
  proposalId: number;
  fundingRoundId: number;
}

export interface CommitteeDeliberationProjectSelectionCreationAttributes extends Optional<CommitteeDeliberationProjectSelectionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FundingRoundVoteLogAttributes extends VoteLogAttributes {
  fundingRoundId: number;
}

export interface FundingRoundVoteLogCreationAttributes extends Optional<FundingRoundVoteLogAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FundingRoundApprovalVoteAttributes extends FundingRoundVoteLogAttributes {
  isPass: boolean;
}

export interface FundingRoundApprovalVoteCreationAttributes extends Optional<FundingRoundApprovalVoteAttributes, 'id' | 'createdAt' | 'updatedAt'> {}