import { ForumChannel, ThreadChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { FundingRound, Proposal } from '../../models';
import { ArgumentOracle, CustomIDOracle } from '../../CustomIDOracle';
import logger from '../../logging';
import { ProjectVotingScreen, SelectProjectAction } from '../vote/screens/ProjectVotingScreen';
import { VoteDashboard } from '../vote/VoteDashboard';
import { EndUserError, NotFoundEndUserError } from '../../Errors';
import { Screen } from '../../core/BaseClasses';
import { ProposalLogic } from '../../logic/ProposalLogic';
import { ProposalStatus } from '../../types';
import { FundingRoundLogic } from '../admin/screens/FundingRoundLogic';

export function proposalStatusToPhase(status: ProposalStatus): string {
    switch (status) {
        case (ProposalStatus.CONSIDERATION_PHASE):
            return "consideration";
        case (ProposalStatus.DELIBERATION_PHASE):
            return "deliberation";
        case (ProposalStatus.FUNDING_VOTING_PHASE):
            return "funding";
        default:
            throw new EndUserError(`Invalid proposal voting phase: ${status.toString()}`)
    }
}

export class ProposalsForumManager {
  private static readonly VOTE_BUTTON_ID = 'vote_button';

  public static async createThread(proposal: Proposal, fundingRound: FundingRound, screen: Screen): Promise<void> {
    try {
      const forumChannel = await this.getForumChannelOrError(fundingRound);
      if (!forumChannel) {
        throw new EndUserError(`Proposal forum channel not found for funding round ${fundingRound.id}`);
      }

      const thread = await forumChannel.threads.create({
        name: proposal.name,
        message: { content: 'Loading proposal details...' },
      });

      await proposal.update({ forumThreadId: thread.id });
      await this.updateThreadContent(thread, proposal, fundingRound, screen);
    } catch (error) {
      throw new EndUserError('Error creating forum thread', error);
    }
  }

  public static async updateThreadContent(thread: ThreadChannel, proposal: Proposal, fundingRound: FundingRound, screen: Screen): Promise<void> {
    try {
      const embed = this.createProposalEmbed(proposal);
      const voteButton = await this.createVoteButton(proposal.id, fundingRound.id, screen);

      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();

      logger.debug(`Updating forum thread ${thread.id}:`);
      if (firstMessage) {
        logger.debug(`\tFirst message. Editing ${firstMessage.id}...`);
        await firstMessage.edit({ content: "", embeds: [embed], components: [voteButton] });
      } else {
        logger.debug(`\tNo first message. Sending new message to thread ${thread.id}...`);
        await thread.send({ embeds: [embed], components: [voteButton] });
      }
    } catch (error) {
      throw new EndUserError('Error updating forum thread', error);
    }
  }

  public static async deleteThread(proposal: Proposal): Promise<void> {
    if (!proposal.forumThreadId) {
      logger.warn(`Proposal ${proposal.id} does not have a forum thread`);
      return;
    }

    if (!proposal.fundingRoundId) {
      logger.warn(`Proposal ${proposal.id} is not associated with a funding round`);
      return;
    }

    try {
      const fundingRound = await FundingRound.findByPk(proposal.fundingRoundId);
      if (!fundingRound) throw new EndUserError('Funding round not found');

      const forumChannel = await this.getForumChannelOrError(fundingRound);

      if (!forumChannel) {
        throw new EndUserError(`Proposal forum channel not found for funding round ${fundingRound.id}.`);
      }

      const thread = await forumChannel.threads.fetch(proposal.forumThreadId);
      if (thread) {
        logger.debug(`Deleting forum thread ${thread.id}...`);
        await thread.delete();
      }
      await proposal.update({ forumThreadId: null });
    } catch (error) {
      throw new EndUserError('Error deleting forum thread', error);
    }
  }

  public static async refreshThread(proposal: Proposal, screen: Screen): Promise<void> {
    if (!proposal.forumThreadId) {
      logger.warn(`Proposal ${proposal.id} does not have a forum thread`);
      return;
    }

    if (!proposal.fundingRoundId) {
      logger.warn(`Proposal ${proposal.id} is not associated with a funding round`);
      return;
    }

    try {
      const fundingRound = await FundingRound.findByPk(proposal.fundingRoundId);
      if (!fundingRound) throw new EndUserError('Funding round not found');

      const forumChannel = await this.getForumChannelOrError(fundingRound);
      if (!forumChannel) {
        throw new EndUserError(`Proposal forum channel not found for funding round ${fundingRound.id}`);
      }

      const thread = await forumChannel.threads.fetch(proposal.forumThreadId);
      if (thread) {
        await this.updateThreadContent(thread, proposal, fundingRound, screen);
      }
    } catch (error) {
      throw new EndUserError('Error refreshing forum thread', error);
    }
  }

  private static createProposalEmbed(proposal: Proposal): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(proposal.name)
      .setDescription('See the details of the proposal and vote on it below.')
      .addFields(
        { name: 'Budget', value: proposal.budget.toString(), inline: true },
        { name: 'Status', value: proposal.status, inline: true },
        { name: 'URI', value: proposal.uri }
      )
      .setColor('#0099ff');
  }

  public static async createVoteButton(proposalId: number, fundingRoundId: number, screen: any): Promise<ActionRowBuilder<ButtonBuilder>> {
    const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundId);
    
    if (!fundingRound.forumChannelId) {
      throw new EndUserError(`Funding round ${fundingRoundId} does not have a forum channel`);
    }

    const dashBoardId: string = fundingRound.forumChannelId.toString();
  

    const proposal: Proposal = await ProposalLogic.getProposalByIdOrError(proposalId);
    const proposalPhase: string = proposalStatusToPhase(proposal.status);
    const customId: string = CustomIDOracle.customIdFromRawParts(dashBoardId, ProjectVotingScreen.ID, SelectProjectAction.ID, SelectProjectAction.OPERATIONS.selectProject, 'prId', proposalId.toString(), ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString(), 'ph', proposalPhase);
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel('Vote On This Proposal')
      .setStyle(ButtonStyle.Primary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }

  private static async getForumChannelOrError(fundingRound: FundingRound): Promise<ForumChannel> {
    const { client } = await import("../../bot");

    const guild = client.guilds.cache.first();

    if (!guild) {
      throw new EndUserError('Guild not found');
    }

    const allChannels = await guild.channels.fetch();
    logger.debug(`All channels: ${allChannels.map(channel => channel?.id).join(', ')}`);

    const proposalChannelId: string | null = fundingRound.forumChannelId.toString();

    if (!proposalChannelId) {
      throw new NotFoundEndUserError(`Funding round ${fundingRound.id} does not have a forum channel`);
    }

    //FIXME: ensure proposal is being fetched correcly
    logger.debug(`Fetching proposal channel ${proposalChannelId}...`);
    const channel = await guild.channels.fetch(proposalChannelId);

    if (!channel) {
      throw new NotFoundEndUserError(`Proposal channel ${proposalChannelId} not found in server.`);
    }

    if (!(channel.type === ChannelType.GuildForum)) {
      throw new NotFoundEndUserError(`Proposal channel ${proposalChannelId} exists, but is not a forum channel.`);
    }

    return channel as ForumChannel;

  }
}