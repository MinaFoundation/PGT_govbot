// src/logic/CommitteeDeliberationLogic.ts

import { FundingRound, Proposal, CommitteeDeliberationVoteLog, FundingRoundDeliberationCommitteeSelection, DeliberationPhase } from '../models';
import { Op } from 'sequelize';
import { CommitteeDeliberationVoteChoice, ProposalStatus } from '../types';

export class CommitteeDeliberationLogic {
  static async getEligibleFundingRounds(userId: string): Promise<FundingRound[]> {
    const now = new Date();
    const committeeSelections = await FundingRoundDeliberationCommitteeSelection.findAll({
      where: { duid: userId }
    });

    const eligibleFundingRoundIds = committeeSelections.map(selection => selection.fundingRoundId);

    return await FundingRound.findAll({
      where: {
        id: eligibleFundingRoundIds,
        status: 'APPROVED',
        startAt: { [Op.lte]: now },
        endAt: { [Op.gt]: now },
      },
      include: [{
        model: DeliberationPhase,
        where: {
          startAt: { [Op.lte]: now },
          endAt: { [Op.gt]: now },
        },
      }],
    });
  }

  static async getUnvotedProposalsCount(fundingRoundId: number, userId: string): Promise<number> {
    const allProposals = await this.getEligibleProjects(fundingRoundId, userId, true);

    const votedProposalIds = (await CommitteeDeliberationVoteLog.findAll({
      where: { 
        duid: userId,
        proposalId: allProposals.map(p => p.id),
      },
    })).map(log => log.proposalId);

    return allProposals.filter(p => !votedProposalIds.includes(p.id)).length;
  }

  static async hasVotedProposals(fundingRoundId: number, userId: string): Promise<boolean> {
    const proposalIds = (await Proposal.findAll({
      where: {
        fundingRoundId,
        status: ProposalStatus.DELIBERATION_PHASE,
      },
    })).map(p => p.id);

    const voteCount = await CommitteeDeliberationVoteLog.count({
      where: { 
        duid: userId,
        proposalId: proposalIds,
      },
    });

    return voteCount > 0;
  }

  static async getEligibleProjects(fundingRoundId: number, userId: string, showUnvoted: boolean): Promise<Proposal[]> {
    const allProposals = await Proposal.findAll({
      where: {
        fundingRoundId,
        status: ProposalStatus.DELIBERATION_PHASE,
      },
    });

    const votedProposalIds = (await CommitteeDeliberationVoteLog.findAll({
      where: { 
        duid: userId,
        proposalId: allProposals.map(p => p.id),
      },
    })).map(log => log.proposalId);

    if (showUnvoted) {
      return allProposals.filter(p => !votedProposalIds.includes(p.id));
    } else {
      return allProposals.filter(p => votedProposalIds.includes(p.id));
    }
  }

  static async submitVote(userId: string, projectId: number, fundingRoundId: number, vote: CommitteeDeliberationVoteChoice, reason: string, uri: string): Promise<void> {
    const project = await Proposal.findByPk(projectId);
    const fundingRound = await FundingRound.findByPk(fundingRoundId);

    if (!project || !fundingRound) {
      throw new Error('Project or Funding Round not found.');
    }

    if (project.status !== ProposalStatus.DELIBERATION_PHASE) {
      throw new Error('This project is not in the deliberation phase.');
    }

    const deliberationPhase = await DeliberationPhase.findOne({ where: { fundingRoundId } });
    if (!deliberationPhase) {
      throw new Error('Deliberation phase not found for this funding round.');
    }

    const now = new Date();
    if (now < deliberationPhase.startAt || now > deliberationPhase.endAt) {
      throw new Error('Deliberation phase is not active.');
    }

    await CommitteeDeliberationVoteLog.create({
      duid: userId,
      proposalId: projectId,
      vote: vote,
      reason: reason,
      uri: uri,
    });
  }

  static async hasVotedOnProject(duid: string, projectId: number, fundingRoundId: number): Promise<boolean> {
    const voteLog = await CommitteeDeliberationVoteLog.findOne({
      where: { duid, proposalId: projectId },
    });

    return !!voteLog;
  }
}