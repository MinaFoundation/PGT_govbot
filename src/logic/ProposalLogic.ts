import { EndUserError } from '../Errors';
import logger from '../logging';
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

  static async updateProposal(id: number, data: Partial<ProposalAttributes>, screen?: any): Promise<Proposal | null> {
    const proposal = await Proposal.findByPk(id);
    if (!proposal) {
      return null;
    }
    await proposal.update(data);

    if (screen && proposal.fundingRoundId && proposal.forumThreadId) {
      try {
        const { ProposalsForumManager } = await import('../channels/proposals/ProposalsForumManager');
        await ProposalsForumManager.refreshThread(proposal, screen);
      } catch (error) {
        logger.error('Error refreshing forum thread:', error);
      }
    }
    return proposal
  }

  static async deleteProposal(id: number): Promise<boolean> {
    const proposal = await Proposal.findByPk(id);
    if (!proposal) {
      return false;
    }

    if (proposal.forumThreadId) {
      try {
        const { ProposalsForumManager } = await import('../channels/proposals/ProposalsForumManager');
        await ProposalsForumManager.deleteThread(proposal);
      } catch (error) {
        logger.error('Error deleting forum thread:', error);
      }
    }

    await proposal.destroy();
    return true;
  }

  static async submitProposalToFundingRound(proposalId: number, fundingRoundId: number, screen?: any): Promise<Proposal | null> {
    const proposal = await Proposal.findByPk(proposalId);
    const fundingRound = await FundingRound.findByPk(fundingRoundId);

    if (!proposal || !fundingRound) {
      return null;
    }

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new EndUserError('Only draft proposals can be submitted to funding rounds.');
    }

    // Check if the user has permission to submit to this funding round
    const hasPermission = await this.userHasPermissionToSubmit(proposal.proposerDuid, fundingRound.topicId);
    if (!hasPermission) {
      throw new EndUserError('You do not have permission to submit proposals to this funding round.');
    }

    await proposal.update({
      fundingRoundId: fundingRoundId,
      status: ProposalStatus.CONSIDERATION_PHASE
    });

    if (screen) {

      try {
        const { ProposalsForumManager } = await import('../channels/proposals/ProposalsForumManager');
        await ProposalsForumManager.createThread(proposal, fundingRound, screen);
      } catch (error) {
        logger.error('Error creating forum thread for proposal:', error);
        //TODO: Consider whether to revert the proposal update or not?
      }

    }
    return proposal;
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
      throw new EndUserError('Cannot cancel a draft or already cancelled proposal.');
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