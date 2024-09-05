import { FundingRound, Proposal, SMEConsiderationVoteLog, CommitteeDeliberationVoteLog } from '../models';
import { EndUserError } from '../Errors';
import { CommitteeDeliberationVoteChoice } from '../types';

interface VoteResult {
  projectId: number;
  projectName: string;
  proposerDuid: string;
  yesVotes: number;
  noVotes: number;
  approvedModifiedVotes?: number; // Only for deliberation phase
}

export class VoteCountingLogic {
  public static async countVotes(fundingRoundId: number, phase: string): Promise<VoteResult[]> {
    const fundingRound = await FundingRound.findByPk(fundingRoundId, { include: [Proposal] });
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    const { FundingRoundLogic } = await import('../channels/admin/screens/FundingRoundLogic');
    const proposals = await FundingRoundLogic.getProposalsForFundingRound(fundingRoundId);
    let voteResults: VoteResult[] = [];

    switch (phase) {
      case 'consideration':
        voteResults = await this.countConsiderationVotes(proposals);
        break;
      case 'deliberation':
        voteResults = await this.countDeliberationVotes(proposals);
        break;
      case 'voting':
        throw new EndUserError('Voting phase vote counting is not yet implemented');
      default:
        throw new EndUserError(`Invalid phase selected: ${phase}`);
    }

    return voteResults.sort((a, b) => {
      if (a.yesVotes !== b.yesVotes) {
        return b.yesVotes - a.yesVotes; // Sort by yes votes descending
      }
      if (a.noVotes !== b.noVotes) {
        return b.noVotes - a.noVotes; // If yes votes are equal, sort by no votes descending
      }
      // If both yes and no votes are equal, sort by approved modified votes (if present)
      return (b.approvedModifiedVotes || 0) - (a.approvedModifiedVotes || 0);
    });
  }

  private static async countConsiderationVotes(proposals: Proposal[]): Promise<VoteResult[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const yesVotes = await SMEConsiderationVoteLog.count({
          where: { proposalId: proposal.id, isPass: true },
        });
        const noVotes = await SMEConsiderationVoteLog.count({
          where: { proposalId: proposal.id, isPass: false },
        });

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerDuid: proposal.proposerDuid,
          yesVotes,
          noVotes,
        };
      }),
    );
  }

  private static async countDeliberationVotes(proposals: Proposal[]): Promise<VoteResult[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const yesVotes = await CommitteeDeliberationVoteLog.count({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.APPROVED },
        });
        const noVotes = await CommitteeDeliberationVoteLog.count({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.REJECTED },
        });
        const approvedModifiedVotes = await CommitteeDeliberationVoteLog.count({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.APPROVED_MODIFIED },
        });

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerDuid: proposal.proposerDuid,
          yesVotes,
          noVotes,
          approvedModifiedVotes,
        };
      }),
    );
  }
}
