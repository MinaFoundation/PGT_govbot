import { ForumChannel, ThreadChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { EndUserError } from '../../Errors';
import { Screen } from '../../core/BaseClasses';
import { DiscordLimiter } from '../../utils/DiscordLimiter';
import { client } from '../../bot';
import logger from '../../logging';
import { LoginScreen } from './screens/LoginScreen';
import { CustomIDOracle } from '../../CustomIDOracle';
import { LoginDashboard } from './LoginDashboard';
import { GenerateLoginTokenAction } from './actions/GenerateLoginTokenAction';

export class LoginForumManager {
  private static readonly LOGIN_THREAD_TITLE = 'Login to MEF';

  public static async initialize(loginForumChannelId: string, screen: LoginScreen): Promise<void> {
    try {
      const forumChannel = await this.getForumChannelOrError(loginForumChannelId);
      await this.ensureLoginThread(forumChannel, screen);
    } catch (error) {
      throw new EndUserError('Failed to initialize login forum', error);
    }
  }

  private static async getForumChannelOrError(channelId: string): Promise<ForumChannel> {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new EndUserError(`Channel ${channelId} not found`);
    }

    if (channel.type !== ChannelType.GuildForum) {
      throw new EndUserError(`Channel ${channelId} is not a forum channel`);
    }

    return channel as ForumChannel;
  }

  private static async ensureLoginThread(forumChannel: ForumChannel, screen: LoginScreen): Promise<void> {
    // Find existing login thread
    const threads = await forumChannel.threads.fetch();
    const loginThread = threads.threads.find(thread => thread.name === this.LOGIN_THREAD_TITLE);

    if (loginThread) {
      // Update existing thread
      await this.updateThreadContent(loginThread, screen);
    } else {
      // Create new thread
      const thread = await forumChannel.threads.create({
        name: this.LOGIN_THREAD_TITLE,
        message: { content: 'Initializing login interface...' },
      });
      await this.updateThreadContent(thread, screen);
    }
  }

  private static async updateThreadContent(thread: ThreadChannel, screen: LoginScreen): Promise<void> {
    const embed = this.createLoginEmbed();
    const loginButton = this.createLoginButton(screen, thread.parentId!);

    const messages = await thread.messages.fetch({ limit: 1 });
    const firstMessage = messages.first();

    if (firstMessage) {
      await firstMessage.edit({
        content: '',
        embeds: [embed],
        components: [loginButton]
      });
    } else {
      await thread.send({
        embeds: [embed],
        components: [loginButton]
      });
    }
  }

  private static createLoginEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🔐 Login to MEF')
      .setDescription(
        'Welcome to the MEF Login Portal!\n\n' +
        '**How to Login:**\n' +
        '1. Click the "Login to MEF" button below\n' +
        '2. You\'ll receive a secure login link (valid for 30 seconds)\n' +
        '3. Click the link to access the MEF web application\n\n' +
        '⚠️ For security reasons, each login link expires after 30 seconds.'
      )
      .setColor('#0099ff');
  }

  private static createLoginButton(screen: LoginScreen, forumChannelId: string): ActionRowBuilder<ButtonBuilder> {
    // Create customId with forum channel ID as the dashboard ID
    const customId = CustomIDOracle.customIdFromRawParts(
      forumChannelId,
      LoginScreen.ID,
      GenerateLoginTokenAction.ID,
      GenerateLoginTokenAction.OPERATION_IDS.GENERATE_LOGIN_TOKEN
    );

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel('Login to MEF')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔐');

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }
} 