// src/logic/VoteLogic.ts

import { ProposalLogic } from './ProposalLogic';
import { FundingRoundApprovalVote, GPTSummarizerVoteLog, SMEConsiderationVoteLog } from '../models';
import { FundingRoundStatus, ProposalStatus } from '../types';
import { FundingRoundLogic } from '../channels/admin/screens/FundingRoundLogic';
import { EndUserError } from '../Errors';


export class VoteLogic {
  static async voteFundingRound(userId: string, fundingRoundId: number): Promise<void> {
    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      throw new EndUserError('This funding round is not open for voting');
    }

    if (fundingRound.votingOpenUntil && fundingRound.votingOpenUntil < new Date()) {
      throw new EndUserError('Voting period for this funding round has ended');
    }

    await FundingRoundApprovalVote.upsert({
      duid: userId,
      fundingRoundId: fundingRoundId,
      isPass: true,
    });
  }

  static async unvoteFundingRound(userId: string, fundingRoundId: number): Promise<void> {
    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      throw new EndUserError('This funding round is not open for voting');
    }

    if (fundingRound.votingOpenUntil && fundingRound.votingOpenUntil < new Date()) {
      throw new EndUserError('Voting period for this funding round has ended');
    }

    await FundingRoundApprovalVote.upsert({
      duid: userId,
      fundingRoundId: fundingRoundId,
      isPass: false,
    });
  }

  static async submitDeliberationReasoning(userId: string, projectId: number, fundingRoundId: number, reasoning: string, reason: string | null = null): Promise<void> {
    const proposal = await ProposalLogic.getProposalById(projectId);
    if (!proposal) {
      throw new EndUserError('Project not found');
    }

    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (proposal.status !== ProposalStatus.DELIBERATION_PHASE) {
      throw new EndUserError('This project is not in the deliberation phase');
    }

    const deliberationPhase = await FundingRoundLogic.getFundingRoundPhase(fundingRoundId, 'deliberation');
    if (!deliberationPhase) {
      throw new EndUserError('Deliberation phase not found for this funding round');
    }

    const now = new Date();
    if (now < deliberationPhase.startAt || now > deliberationPhase.endAt) {
      throw new EndUserError('Deliberation phase is not active');
    }

    await GPTSummarizerVoteLog.create({
      duid: userId,
      proposalId: projectId,
      why: reasoning,
      reason: reason,
    });
  }

  static async hasUserVotedOnFundingRound(userId: string, fundingRoundId: number): Promise<boolean> {
    const vote = await FundingRoundApprovalVote.findOne({
      where: {
        duid: userId,
        fundingRoundId: fundingRoundId,
      },
    });
    return !!vote;
  }

  static async getLatestVote(userId: string, fundingRoundId: number): Promise<FundingRoundApprovalVote | null> {
    return await FundingRoundApprovalVote.findOne({
      where: {
        duid: userId,
        fundingRoundId: fundingRoundId,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  static async canChangeVote(userId: string, fundingRoundId: number): Promise<boolean> {
    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      return false;
    }

    if (fundingRound.votingOpenUntil && fundingRound.votingOpenUntil < new Date()) {
      return false;
    }

    return true;
  }

  static async getDeliberationReasoning(userId: string, projectId: number): Promise<string | null> {
    const voteLog = await GPTSummarizerVoteLog.findOne({
      where: {
        duid: userId,
        proposalId: projectId,
      },
      order: [['createdAt', 'DESC']],
    });

    return voteLog ? voteLog.why : null;
  }

  static async hasUserSubmittedDeliberationReasoning(userId: string, projectId: number): Promise<boolean> {
    const voteLog = await GPTSummarizerVoteLog.findOne({
      where: {
        duid: userId,
        proposalId: projectId,
      },
    });

    return !!voteLog;
  }

  static async getVotingStatus(userId: string, fundingRoundId: number): Promise<{ hasVoted: boolean; isApproved: boolean | null }> {
    const latestVote = await this.getLatestVote(userId, fundingRoundId);

    if (!latestVote) {
      return { hasVoted: false, isApproved: null };
    }

    return { hasVoted: true, isApproved: latestVote.isPass };
  }

  static async getDeliberationReasoningCount(projectId: number): Promise<number> {
    return await GPTSummarizerVoteLog.count({
      where: {
        proposalId: projectId,
      },
    });
  }

  static async recordConsiderationVote(userId: string, projectId: number, isPass: boolean, reason: string | null): Promise<void> {
    const proposal = await ProposalLogic.getProposalById(projectId);
    if (!proposal) {
      throw new EndUserError('Project not found');
    }

    if (proposal.status !== ProposalStatus.CONSIDERATION_PHASE) {
      throw new EndUserError('This project is not in the consideration phase');
    }

    await SMEConsiderationVoteLog.create({
      duid: userId,
      proposalId: projectId,
      isPass: isPass,
      reason: reason,
    });
  }

  static async getConsiderationVoteStatus(userId: string, projectId: number): Promise<{ hasVoted: boolean; isPass: boolean | null }> {
    const voteLog = await SMEConsiderationVoteLog.findOne({
      where: {
        duid: userId,
        proposalId: projectId,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!voteLog) {
      return { hasVoted: false, isPass: null };
    }

    return { hasVoted: true, isPass: voteLog.isPass };
  }
}