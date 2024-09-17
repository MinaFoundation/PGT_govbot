import { FundingRound, Proposal, SMEConsiderationVoteLog, CommitteeDeliberationVoteLog } from '../models';
import { EndUserError } from '../Errors';
import { CommitteeDeliberationVoteChoice } from '../types';
import { TrackedInteraction } from '../core/BaseClasses';
import logger from '../logging';
import { Op } from 'sequelize';
import { EmbedBuilder } from 'discord.js';

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

interface VoteResultWithReasoning extends VoteResult {
  deliberationVotes: {
    voterUsername: string;
    vote: CommitteeDeliberationVoteChoice;
    reason: string | null;
  }[];
  considerationVotes: {
    voterUsername: string;
    isPass: boolean;
    reason: string | null;
  }[];
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

  public static async countVotesWithReasoning(
    fundingRoundId: number,
    phase: string,
    trackedInteraction: TrackedInteraction,
  ): Promise<VoteResultWithReasoning[]> {
    const fundingRound = await FundingRound.findByPk(fundingRoundId, { include: [Proposal] });
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    const { FundingRoundLogic } = await import('../channels/admin/screens/FundingRoundLogic');
    const proposals = await FundingRoundLogic.getProposalsForFundingRound(fundingRoundId);
    let voteResults: VoteResultWithReasoning[] = [];

    switch (phase) {
      case 'consideration':
        voteResults = await this.countConsiderationVotesWithReasoning(proposals, trackedInteraction);
        break;
      case 'deliberation':
        voteResults = await this.countDeliberationVotesWithReasoning(proposals, trackedInteraction);
        break;
      case 'voting':
        throw new EndUserError('Voting phase vote counting is not yet implemented');
      default:
        throw new EndUserError(`Invalid phase selected: ${phase}`);
    }

    return voteResults.sort((a, b) => {
      if (a.yesVotes !== b.yesVotes) {
        return b.yesVotes - a.yesVotes;
      }
      if (a.noVotes !== b.noVotes) {
        return b.noVotes - a.noVotes;
      }
      return (b.approvedModifiedVotes || 0) - (a.approvedModifiedVotes || 0);
    });
  }

  private static async countConsiderationVotesWithReasoning(
    proposals: Proposal[],
    trackedInteraction: TrackedInteraction,
  ): Promise<VoteResultWithReasoning[]> {
    return Promise.all(
      proposals.map(async (proposal) => {
        const allVotes = await SMEConsiderationVoteLog.findAll({
          where: { proposalId: proposal.id },
          order: [['createdAt', 'DESC']],
        });

        const latestVotes = new Map<string, boolean>();
        const yesVoters: string[] = [];
        const noVoters: string[] = [];
        const considerationVotes: VoteResultWithReasoning['considerationVotes'] = [];

        for (const vote of allVotes) {
          if (!latestVotes.has(vote.duid)) {
            latestVotes.set(vote.duid, vote.isPass);
            const voterUsername = await this.getUsername(trackedInteraction, vote.duid);
            considerationVotes.push({
              voterUsername,
              isPass: vote.isPass,
              reason: vote.reason,
            });
            if (vote.isPass) {
              yesVoters.push(vote.duid);
            } else {
              noVoters.push(vote.duid);
            }
          }
        }

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
          deliberationVotes: [],
          considerationVotes,
        };
      }),
    );
  }

  private static async countDeliberationVotesWithReasoning(
    proposals: Proposal[],
    trackedInteraction: TrackedInteraction,
  ): Promise<VoteResultWithReasoning[]> {
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
        const deliberationVotes: VoteResultWithReasoning['deliberationVotes'] = [];

        for (const vote of allVotes) {
          if (!latestVotes.has(vote.duid)) {
            latestVotes.set(vote.duid, vote.vote);
            const voterUsername = await this.getUsername(trackedInteraction, vote.duid);
            deliberationVotes.push({
              voterUsername,
              vote: vote.vote,
              reason: vote.reason,
            });
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
        }

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
          deliberationVotes,
          considerationVotes: [],
        };
      }),
    );
  }

  public static formatVoteReasoningMessage(voteResults: VoteResultWithReasoning[]): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    for (const result of voteResults) {
      if (result.deliberationVotes.length === 0 && result.considerationVotes.length === 0) {
        continue; // Skip projects with no votes
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Vote Reasoning - ${result.projectName} (ID: ${result.projectId})`)
        .setDescription(`Proposer: ${result.proposerUsername}`);

      if (result.deliberationVotes.length > 0) {
        let deliberationField = '';
        for (const vote of result.deliberationVotes) {
          deliberationField += `**${vote.voterUsername}**: ${vote.vote}\n`;
          deliberationField += `Reasoning: ${vote.reason || 'No reason provided'}\n\n`;
        }
        embed.addFields({ name: 'Deliberation Phase Votes', value: deliberationField.trim() });
      }

      if (result.considerationVotes.length > 0) {
        let considerationField = '';
        for (const vote of result.considerationVotes) {
          considerationField += `**${vote.voterUsername}**: ${vote.isPass ? 'Yes' : 'No'}\n`;
          considerationField += `Reasoning: ${vote.reason || 'No reason provided'}\n\n`;
        }
        embed.addFields({ name: 'Consideration Phase Votes', value: considerationField.trim() });
      }

      embeds.push(embed);
    }

    return embeds;
  }
}