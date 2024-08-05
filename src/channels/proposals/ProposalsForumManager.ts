import { ForumChannel, ThreadChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { FundingRound, Proposal } from '../../models';
import { CustomIDOracle } from '../../CustomIDOracle';
import logger from '../../logging';
import { ProjectVotingScreen, SelectProjectAction } from '../vote/screens/ProjectVotingScreen';
import { VoteDashboard } from '../vote/VoteDashboard';
import { EndUserError } from '../../Errors';

export class ProposalsForumManager {
  private static readonly VOTE_BUTTON_ID = 'vote_button';

  public static async createThread(proposal: Proposal, fundingRound: FundingRound, screen: Screen): Promise<void> {
    try {
      const forumChannel = await this.getForumChannel(fundingRound);
      if (!forumChannel) {
        throw new EndUserError('Forum channel not found');
      }

      const thread = await forumChannel.threads.create({
        name: proposal.name,
        message: { content: 'Loading proposal details...' },
      });

      await proposal.update({ forumThreadId: thread.id });
      await this.updateThreadContent(thread, proposal, fundingRound, screen);
    } catch (error) {
      logger.error('Error creating forum thread:', error);
      throw error;
    }
  }

  public static async updateThreadContent(thread: ThreadChannel, proposal: Proposal, fundingRound: FundingRound, screen: Screen): Promise<void> {
    try {
      const embed = this.createProposalEmbed(proposal);
      const voteButton = this.createVoteButton(proposal.id, fundingRound.id, screen);

      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();

      if (firstMessage) {
        await firstMessage.edit({ embeds: [embed], components: [voteButton] });
      } else {
        await thread.send({ embeds: [embed], components: [voteButton] });
      }
    } catch (error) {
      logger.error('Error updating forum thread content:', error);
      throw error;
    }
  }

  public static async deleteThread(proposal: Proposal): Promise<void> {
    if (!proposal.forumThreadId) return;

    if (!proposal.fundingRoundId) {
      logger.warn(`Proposal ${proposal.id} is not associated with a funding round`);
      return;
    }

    try {
      const fundingRound = await FundingRound.findByPk(proposal.fundingRoundId);
      if (!fundingRound) throw new EndUserError('Funding round not found');

      const forumChannel = await this.getForumChannel(fundingRound);
      if (!forumChannel) return;

      const thread = await forumChannel.threads.fetch(proposal.forumThreadId);
      if (thread) {
        await thread.delete();
      }
      await proposal.update({ forumThreadId: null });
    } catch (error) {
      logger.error('Error deleting forum thread:', error);
      throw error;
    }
  }

  public static async refreshThread(proposal: Proposal, screen: any): Promise<void> {
    if (!proposal.forumThreadId) return;

    if (!proposal.fundingRoundId) {
      logger.warn(`Proposal ${proposal.id} is not associated with a funding round`);
      return;
    }

    try {
      const fundingRound = await FundingRound.findByPk(proposal.fundingRoundId);
      if (!fundingRound) throw new EndUserError('Funding round not found');

      const forumChannel = await this.getForumChannel(fundingRound);
      if (!forumChannel) return;

      const thread = await forumChannel.threads.fetch(proposal.forumThreadId);
      if (thread) {
        await this.updateThreadContent(thread, proposal, fundingRound, screen);
      }
    } catch (error) {
      logger.error('Error refreshing forum thread:', error);
      throw error;
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

  private static createVoteButton(proposalId: number, fundingRoundId: number, screen: any): ActionRowBuilder<ButtonBuilder> {
    const customId: string = CustomIDOracle.customIdFromRawParts(VoteDashboard.ID, ProjectVotingScreen.ID, SelectProjectAction.ID, SelectProjectAction.OPERATIONS.selectProject, "projectId", proposalId.toString(), "fundingRoundId", fundingRoundId.toString(), "phase", "deliberation");
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel('Vote On This Proposal')
      .setStyle(ButtonStyle.Primary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }

  private static async getForumChannel(fundingRound: FundingRound): Promise<ForumChannel | null> {
    //if (!fundingRound.forumChannelName) return null;

    const { client } = await import("../../bot");

    const guild = client.guilds.cache.first();

    if (!guild) {
      throw new EndUserError('Guild not found');
    }

    const allChannels = await guild.channels.fetch();
    logger.info("Hello")
    logger.info(`All channels: ${allChannels.map(channel => channel?.name).join(', ')}`);
    // TODO: read channel from FundingRound
    const channel = await guild.channels.fetch("1255865955909636106");

    return channel && channel.type === ChannelType.GuildForum ? channel as ForumChannel : null;
  }
}