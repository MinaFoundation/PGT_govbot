import { Screen } from '../core/BaseClasses';
import { EndUserError } from '../Errors';
import { FundingRound, Proposal } from '../models';
import { FundingRoundStatus, ProposalStatus } from '../types';

export class AdminProposalLogic {
  static async getProposalById(id: number): Promise<Proposal | null> {
    return await Proposal.findByPk(id);
  }

  static async getProposalsForFundingRound(fundingRoundId: number): Promise<Proposal[]> {
    return await Proposal.findAll({
      where: { fundingRoundId },
      order: [['createdAt', 'DESC']],
    });
  }

  static async updateProposalStatus(id: number, newStatus: ProposalStatus, screen?: Screen): Promise<Proposal> {
    const proposal = await this.getProposalById(id);
    if (!proposal) {
      throw new EndUserError('Proposal not found');
    }

    if (!proposal.fundingRoundId) {
      throw new EndUserError(`Proposal ${id} does not have a Funding Round associated`);
    }

    const { ProposalLogic } = await import('../logic/ProposalLogic');
    const updatedProposal: Proposal = await ProposalLogic.updateProposalStatus(id, newStatus, screen);

    return updatedProposal;
  }
}
