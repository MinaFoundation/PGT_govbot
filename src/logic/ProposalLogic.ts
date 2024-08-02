import { Proposal, FundingRound, TopicSMEGroupProposalCreationLimiter, SMEGroupMembership } from '../models';
import { FundingRoundStatus, ProposalAttributes, ProposalCreationAttributes, ProposalStatus } from '../types';

export class ProposalLogic {
  static async getUserDraftProposals(userId: string): Promise<Proposal[]> {
    return await Proposal.findAll({
      where: {
        proposerDuid: userId,
        status: ProposalStatus.DRAFT
      },
      order: [['createdAt', 'DESC']]
    });
  }

  static async getProposalById(id: number): Promise<Proposal | null> {
    return await Proposal.findByPk(id);
  }

  static async createProposal(data: ProposalCreationAttributes): Promise<Proposal> {
    return await Proposal.create({
      ...data,
      status: ProposalStatus.DRAFT
    });
  }

  static async updateProposal(id: number, data: Partial<ProposalAttributes>): Promise<Proposal | null> {
    const proposal = await Proposal.findByPk(id);
    if (!proposal) {
      return null;
    }
    return await proposal.update(data);
  }

  static async deleteProposal(id: number): Promise<boolean> {
    const proposal = await Proposal.findByPk(id);
    if (!proposal) {
      return false;
    }
    await proposal.destroy();
    return true;
  }

  static async submitProposalToFundingRound(proposalId: number, fundingRoundId: number): Promise<Proposal | null> {
    const proposal = await Proposal.findByPk(proposalId);
    const fundingRound = await FundingRound.findByPk(fundingRoundId);

    if (!proposal || !fundingRound) {
      return null;
    }

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new Error('Only draft proposals can be submitted to funding rounds.');
    }

    // Check if the user has permission to submit to this funding round
    const hasPermission = await this.userHasPermissionToSubmit(proposal.proposerDuid, fundingRound.topicId);
    if (!hasPermission) {
      throw new Error('You do not have permission to submit proposals to this funding round.');
    }

    return await proposal.update({
      fundingRoundId: fundingRoundId,
      status: ProposalStatus.CONSIDERATION_PHASE
    });
  }

  static async getUserProposalsForFundingRound(userId: string, fundingRoundId: number): Promise<Proposal[]> {
    return await Proposal.findAll({
      where: {
        proposerDuid: userId,
        fundingRoundId: fundingRoundId
      },
      order: [['createdAt', 'DESC']]
    });
  }

  static async cancelProposal(proposalId: number): Promise<Proposal | null> {
    const proposal = await Proposal.findByPk(proposalId);
    if (!proposal) {
      return null;
    }

    if (proposal.status === ProposalStatus.DRAFT || proposal.status === ProposalStatus.CANCELLED) {
      throw new Error('Cannot cancel a draft or already cancelled proposal.');
    }

    return await proposal.update({ status: ProposalStatus.CANCELLED });
  }

  private static async userHasPermissionToSubmit(userId: string, topicId: number): Promise<boolean> {
    // Check if there are any limitations for this topic
    const limitations = await TopicSMEGroupProposalCreationLimiter.findAll({
      where: { topicId: topicId }
    });

    // If there are no limitations, everyone can submit
    if (limitations.length === 0) {
      return true;
    }

    // Check if the user belongs to any of the allowed SME groups
    const userMemberships = await SMEGroupMembership.findAll({
      where: { duid: userId }
    });

    const userSMEGroupIds = userMemberships.map(membership => membership.smeGroupId);
    const allowedSMEGroupIds = limitations.map(limitation => limitation.smeGroupId);

    return userSMEGroupIds.some(id => allowedSMEGroupIds.includes(id));
  }
  
}