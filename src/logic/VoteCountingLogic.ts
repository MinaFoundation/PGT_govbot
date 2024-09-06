import { FundingRound, Proposal, SMEConsiderationVoteLog, CommitteeDeliberationVoteLog } from '../models';
import { EndUserError } from '../Errors';
import { CommitteeDeliberationVoteChoice } from '../types';
import { TrackedInteraction } from '../core/BaseClasses';
import logger from '../logging';
import { Op } from 'sequelize';

interface VoteResult {
  projectId: number;
  projectName: string;
  proposerUsername: string;
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

  private static async getUsername(trackedInteraction: TrackedInteraction, duid: string): Promise<string> {
    try {
      const user = await trackedInteraction.interaction.client.users.fetch(duid);
      return user.username;
    } catch (error) {
      logger.error(`Error fetching user ${duid}:`, error);
      return duid; // Fallback to using DUID if username can't be fetched
    }
  }

  private static async getVoterUsernames(trackedInteraction: TrackedInteraction, duids: string[]): Promise<string[]> {
    const usernames: string[] = [];
    for (const duid of duids) {
      try {
        const username: string = await this.getUsername(trackedInteraction, duid);
        usernames.push(username);
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
        const allVotes = await SMEConsiderationVoteLog.findAll({
          where: { proposalId: proposal.id },
          order: [['createdAt', 'DESC']],
        });

        const latestVotes = new Map<string, boolean>();
        const yesVoters: string[] = [];
        const noVoters: string[] = [];

        allVotes.forEach((vote) => {
          if (!latestVotes.has(vote.duid)) {
            latestVotes.set(vote.duid, vote.isPass);
            if (vote.isPass) {
              yesVoters.push(vote.duid);
            } else {
              noVoters.push(vote.duid);
            }
          }
        });

        const yesVotes = yesVoters.length;
        const noVotes = noVoters.length;

        const yesVoterUsernames = await this.getVoterUsernames(trackedInteraction, yesVoters);
        const noVoterUsernames = await this.getVoterUsernames(trackedInteraction, noVoters);

        const proposerUsername = await this.getUsername(trackedInteraction, proposal.proposerDuid);

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerUsername,
          yesVotes,
          noVotes,
          yesVoters: yesVoterUsernames,
          noVoters: noVoterUsernames,
        };
      }),
    );
  }

  private static async countDeliberationVotes(proposals: Proposal[], trackedInteraction: TrackedInteraction): Promise<VoteResult[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const allVotes = await CommitteeDeliberationVoteLog.findAll({
          where: { proposalId: proposal.id },
          order: [['createdAt', 'DESC']],
        });

        const latestVotes = new Map<string, CommitteeDeliberationVoteChoice>();
        const yesVoters: string[] = [];
        const noVoters: string[] = [];
        const approvedModifiedVoters: string[] = [];

        allVotes.forEach((vote) => {
          if (!latestVotes.has(vote.duid)) {
            latestVotes.set(vote.duid, vote.vote);
            switch (vote.vote) {
              case CommitteeDeliberationVoteChoice.APPROVED:
                yesVoters.push(vote.duid);
                break;
              case CommitteeDeliberationVoteChoice.REJECTED:
                noVoters.push(vote.duid);
                break;
              case CommitteeDeliberationVoteChoice.APPROVED_MODIFIED:
                approvedModifiedVoters.push(vote.duid);
                break;
            }
          }
        });

        const yesVotes = yesVoters.length;
        const noVotes = noVoters.length;
        const approvedModifiedVotes = approvedModifiedVoters.length;

        const yesVoterUsernames = await this.getVoterUsernames(trackedInteraction, yesVoters);
        const noVoterUsernames = await this.getVoterUsernames(trackedInteraction, noVoters);
        const approvedModifiedVoterUsernames = await this.getVoterUsernames(trackedInteraction, approvedModifiedVoters);

        const proposerUsername = await this.getUsername(trackedInteraction, proposal.proposerDuid);

        return {
          projectId: proposal.id,
          projectName: proposal.name,
          proposerUsername,
          yesVotes,
          noVotes,
          approvedModifiedVotes,
          yesVoters: yesVoterUsernames,
          noVoters: noVoterUsernames,
          approvedModifiedVoters: approvedModifiedVoterUsernames,
        };
      }),
    );
  }
}
