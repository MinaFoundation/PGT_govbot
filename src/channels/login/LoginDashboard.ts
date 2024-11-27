import { Dashboard, TrackedInteraction } from '../../core/BaseClasses';
import { client } from '../../bot';
import logger from '../../logging';
import { ChannelType, ThreadChannel } from 'discord.js';
import { CustomIDOracle } from '../../CustomIDOracle';

export class LoginDashboard extends Dashboard {
  public static readonly ID = 'login';
  public static readonly DEFAULT_FORUM_CHANNEL_ID = '1301096522452303894';

  constructor() {
    super(LoginDashboard.ID);
  }

  public async isFallback(interaction: TrackedInteraction): Promise<boolean> {
    // First check if this interaction has a customId (button clicks do)
    if (!interaction.customId) {
      return false;
    }

    // Get the dashboard ID from the customId (which is the forum channel ID)
    const forumChannelId = CustomIDOracle.getDashboardId(interaction.customId);
    if (!forumChannelId) {
      return false;
    }

    // Check if this is our login forum channel
    const loginForumId = process.env.LOGIN_FORUM_CHANNEL_ID || LoginDashboard.DEFAULT_FORUM_CHANNEL_ID;
    return forumChannelId === loginForumId;
  }
} 