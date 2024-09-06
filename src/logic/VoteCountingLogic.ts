import { FundingRound, Proposal, SMEConsiderationVoteLog, CommitteeDeliberationVoteLog } from '../models';
import { EndUserError } from '../Errors';
import { CommitteeDeliberationVoteChoice } from '../types';
import { TrackedInteraction } from '../core/BaseClasses';
import logger from '../logging';

interface VoteResult {
  projectId: number;
  projectName: string;
  proposerDuid: string;
  yesVotes: number;
  noVotes: number;
  approvedModifiedVotes?: number;
  yesVoters: string[];
  noVoters: string[];
  approvedModifiedVoters?: string[];
}

export class VoteCountingLogic {
  public static async countVotes(fundingRoundId: number, phase: string, trackedInteraction: TrackedInteraction): Promise<VoteResult[]> {
    const fundingRound = await FundingRound.findByPk(fundingRoundId, { include: [Proposal] });
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    const { FundingRoundLogic } = await import('../channels/admin/screens/FundingRoundLogic');
    const proposals = await FundingRoundLogic.getProposalsForFundingRound(fundingRoundId);
    let voteResults: VoteResult[] = [];

    switch (phase) {
      case 'consideration':
        voteResults = await this.countConsiderationVotes(proposals, trackedInteraction);
        break;
      case 'deliberation':
        voteResults = await this.countDeliberationVotes(proposals, trackedInteraction);
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

  private static async getVoterUsernames(trackedInteraction: TrackedInteraction, duids: string[]): Promise<string[]> {
    const usernames: string[] = [];
    for (const duid of duids) {
      try {
        const user = await trackedInteraction.interaction.client.users.fetch(duid);
        usernames.push(user.username);
      } catch (error) {
        logger.error(`Error fetching user ${duid}:`, error);
        usernames.push(duid); // Fallback to using DUID if username can't be fetched
      }
    }
    return usernames;
  }

  private static async countConsiderationVotes(proposals: Proposal[], trackedInteraction: TrackedInteraction): Promise<VoteResult[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const yesVotes = await SMEConsiderationVoteLog.findAll({
          where: { proposalId: proposal.id, isPass: true },
        });
        const noVotes = await SMEConsiderationVoteLog.findAll({
          where: { proposalId: proposal.id, isPass: false },
        });

        const yesVoters = await this.getVoterUsernames(
          trackedInteraction,
          yesVotes.map((vote) => vote.duid),
        );
        const noVoters = await this.getVoterUsernames(
          trackedInteraction,
          noVotes.map((vote) => vote.duid),
        );

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerDuid: proposal.proposerDuid,
          yesVotes: yesVotes.length,
          noVotes: noVotes.length,
          yesVoters,
          noVoters,
        };
      }),
    );
  }

  private static async countDeliberationVotes(proposals: Proposal[], trackedInteraction: TrackedInteraction): Promise<VoteResult[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const yesVotes = await CommitteeDeliberationVoteLog.findAll({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.APPROVED },
        });
        const noVotes = await CommitteeDeliberationVoteLog.findAll({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.REJECTED },
        });
        const approvedModifiedVotes = await CommitteeDeliberationVoteLog.findAll({
          where: { proposalId: proposal.id, vote: CommitteeDeliberationVoteChoice.APPROVED_MODIFIED },
        });

        const yesVoters = await this.getVoterUsernames(
          trackedInteraction,
          yesVotes.map((vote) => vote.duid),
        );
        const noVoters = await this.getVoterUsernames(
          trackedInteraction,
          noVotes.map((vote) => vote.duid),
        );
        const approvedModifiedVoters = await this.getVoterUsernames(
          trackedInteraction,
          approvedModifiedVotes.map((vote) => vote.duid),
        );

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerDuid: proposal.proposerDuid,
          yesVotes: yesVotes.length,
          noVotes: noVotes.length,
          approvedModifiedVotes: approvedModifiedVotes.length,
          yesVoters,
          noVoters,
          approvedModifiedVoters,
        };
      }),
    );
  }
}
