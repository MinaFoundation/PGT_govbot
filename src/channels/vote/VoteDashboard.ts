import { Dashboard, TrackedInteraction } from '../../core/BaseClasses';
import { FundingRound } from '../../models';
import { CustomIDOracle } from '../../CustomIDOracle';
import { client } from '../../bot';
import logger from '../../logging';
import { ChannelType } from 'discord.js';

export class VoteDashboard extends Dashboard {
  public static readonly ID = 'vote';

  public async isFallback(interaction: TrackedInteraction): Promise<boolean> {
    logger.info(`Checking if ${interaction.customId} is a fallback`);
    const channelId = CustomIDOracle.getDashboardId(interaction.customId);
    if (!channelId) return false;

    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildForum) {
      logger.info(`Forum channel with ID ${channelId} not found in cache or is not a forum channel`);
      return false;
    }

    const fundingRound = await FundingRound.findOne({
      where: { forumChannelId: channelId }
    });

    logger.info(`FundingRound ${fundingRound ? 'found' : 'not found'} for forum channel with ID ${channelId}`);
    return !!fundingRound;
  }
}