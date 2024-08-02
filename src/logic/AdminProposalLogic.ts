import { FundingRound, Proposal } from "../models";
import { ProposalStatus } from "../types";

export class AdminProposalLogic {
    static async getProposalById(id: number): Promise<Proposal | null> {
      return await Proposal.findByPk(id);
    }
  
    static async getProposalsForFundingRound(fundingRoundId: number): Promise<Proposal[]> {
      return await Proposal.findAll({
        where: { fundingRoundId },
        order: [['createdAt', 'DESC']]
      });
    }
  
    static async updateProposalStatus(id: number, newStatus: ProposalStatus): Promise<Proposal> {
      const proposal = await this.getProposalById(id);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (!proposal.fundingRoundId) {
        throw new Error(`Proposal ${id} does not have a Funding Round associated`);
      }
  
      const fundingRound = await FundingRound.findByPk(proposal.fundingRoundId);
      if (!fundingRound) {
        throw new Error('Associated Funding Round not found');
      }
  
      // Validate the status change based on the current Funding Round phase
      if (!this.isValidStatusChange(proposal.status, newStatus, fundingRound)) {
        throw new Error('Invalid status change for the current Funding Round phase');
      }
  
      proposal.status = newStatus;
      await proposal.save();
  
      return proposal;
    }
  
    private static isValidStatusChange(currentStatus: ProposalStatus, newStatus: ProposalStatus, fundingRound: FundingRound): boolean {
      // Implement the logic to validate status changes based on the Funding Round phase
      // This is a simplified example and should be expanded based on your specific requirements
      switch (fundingRound.status) {
        case 'VOTING':
          return newStatus === ProposalStatus.DRAFT || newStatus === ProposalStatus.CONSIDERATION_PHASE;
        case 'APPROVED':
          return true; // Allow all status changes when the Funding Round is approved
        default:
          return false;
      }
    }
  }