import { ForumChannel, ThreadChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PublicThreadChannel } from 'discord.js';
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
    logger.debug('Ensuring login thread exists and is up to date...');

    // Fetch all active threads
    const activeThreads = await forumChannel.threads.fetchActive();
    logger.debug(`Found ${activeThreads.threads.size} active threads`);

    // Find the login thread among active threads
    let loginThread = activeThreads.threads.find(thread => 
      thread.name === this.LOGIN_THREAD_TITLE && 
      thread.type === ChannelType.PublicThread
    ) as PublicThreadChannel | undefined;

    if (!loginThread) {
      // If not found in active threads, check archived threads
      const archivedThreads = await forumChannel.threads.fetchArchived();
      logger.debug(`Found ${archivedThreads.threads.size} archived threads`);

      loginThread = archivedThreads.threads.find(thread => 
        thread.name === this.LOGIN_THREAD_TITLE && 
        thread.type === ChannelType.PublicThread
      ) as PublicThreadChannel | undefined;

      if (loginThread) {
        // If found in archived threads, unarchive it
        logger.debug('Found login thread in archives, unarchiving...');
        await loginThread.setArchived(false);
      }
    }

    if (!loginThread) {
      // If not found anywhere, create a new thread
      logger.debug('No login thread found, creating new one...');
      const newThread = await forumChannel.threads.create({
        name: this.LOGIN_THREAD_TITLE,
        message: { content: 'Initializing login interface...' },
      });

      // Cast the new thread to PublicThreadChannel
      loginThread = newThread as PublicThreadChannel;
    }

    // Update the thread content
    logger.debug('Updating thread content...');
    if (loginThread) {
      await this.updateThreadContent(loginThread, screen);
    } else {
      logger.error('Failed to create or find login thread');
    }
  }

  private static async updateThreadContent(thread: PublicThreadChannel, screen: LoginScreen): Promise<void> {
    const embed = this.createLoginEmbed();
    const loginButton = this.createLoginButton(screen, thread.parentId!);

    // Fetch all messages in the thread
    const messages = await thread.messages.fetch();
    const firstMessage = messages.last(); // Get the oldest message (the initial post)

    if (firstMessage) {
      logger.debug(`Updating first message ${firstMessage.id} in thread ${thread.id}`);
      await firstMessage.edit({
        content: '',
        embeds: [embed],
        components: [loginButton]
      });
    } else {
      logger.debug(`No messages found in thread ${thread.id}, creating new message`);
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
        'Welcome to the MEF Login Dashboard!\n\n' +
        'Here, you can authenticate to the MEF web application, where you can create, view & vote on proposals.\n\n' +
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