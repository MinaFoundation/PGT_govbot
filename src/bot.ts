import { CacheType, Client, GatewayIntentBits, Interaction, TextChannel, ChannelType } from 'discord.js';
import { config } from 'dotenv';
import { DashboardManager } from './core/DashboardManager';
import { AdminDashboard } from './channels/admin/dashboard';
import { syncDatabase } from './models';
import { AdminHomeScreen } from './channels/admin/screens/AdminHomeScreen';
import { AnyInteraction, HomeScreen } from './types/common';
import { FundingRoundInitDashboard } from './channels/funding-round-init/FundingRoundInitDashboard';
import { FundingRoundInitScreen } from './channels/funding-round-init/screens/FundingRoundInitScreen';
import { ProposeDashboard } from './channels/propose/ProposeDashboard';
import { ProposalHomeScreen } from './channels/propose/screens/ProposalHomeScreen';
import { VoteDashboard } from './channels/vote/VoteDashboard';
import { VoteHomeScreen } from './channels/vote/screens/VoteHomeScreen';
import { CommitteeDeliberationDashboard } from './channels/deliberate/CommitteeDeliberationDashboard';
import { CommitteeDeliberationHomeScreen } from './channels/deliberate/CommitteeDeliberationHomeScreen';
import { ConsiderDashboard } from './channels/consider/ConsiderDashboard';
import { ConsiderationHomeScreen } from './channels/consider/screens/ConsiderationHomeScreen';
import logger from './logging';
import { DiscordStatus } from './channels/DiscordStatus';
import { TrackedInteraction } from './core/BaseClasses';
import { networkInterfaces } from 'os';
import { startServer } from './app';
import { LoginDashboard } from './channels/login/LoginDashboard';
import { LoginScreen } from './channels/login/screens/LoginScreen';
import { LoginForumManager } from './channels/login/LoginForumManager';

config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const dashboardManager = new DashboardManager();

client.once('ready', async () => {
  logger.info('Bot is ready!');
  await syncDatabase();

  // Start the Express server
  await startServer();

  // Register dashboards
  const adminDashboard = new AdminDashboard(AdminDashboard.ID);
  const homeScreen: HomeScreen = new AdminHomeScreen(adminDashboard, AdminHomeScreen.ID);
  adminDashboard.homeScreen = homeScreen;
  dashboardManager.registerDashboard('admin', adminDashboard);

  const fundingRoundInitDashboard = new FundingRoundInitDashboard(FundingRoundInitDashboard.ID);
  const fundingRoundInitHomeScreen: HomeScreen = new FundingRoundInitScreen(fundingRoundInitDashboard, FundingRoundInitScreen.ID);
  fundingRoundInitDashboard.homeScreen = fundingRoundInitHomeScreen;
  dashboardManager.registerDashboard('funding-round-init', fundingRoundInitDashboard);

  const proposeDashboard = new ProposeDashboard(ProposeDashboard.ID);
  const proposeHomeScreen: ProposalHomeScreen = new ProposalHomeScreen(proposeDashboard, ProposalHomeScreen.ID);
  proposeDashboard.homeScreen = proposeHomeScreen;
  dashboardManager.registerDashboard('propose', proposeDashboard);
  dashboardManager.registerDashboard('proposals', proposeDashboard);

  const voteDashboard = new VoteDashboard(VoteDashboard.ID);
  const voteHomeScreen: HomeScreen = new VoteHomeScreen(voteDashboard, VoteHomeScreen.ID);
  voteDashboard.homeScreen = voteHomeScreen;
  dashboardManager.registerDashboard('vote', voteDashboard);
  dashboardManager.registerDashboard('proposals', voteDashboard);

  const committeeDeliberationDashboard = new CommitteeDeliberationDashboard(CommitteeDeliberationDashboard.ID);
  const deliberationHomeScreen: HomeScreen = new CommitteeDeliberationHomeScreen(committeeDeliberationDashboard, CommitteeDeliberationHomeScreen.ID);
  committeeDeliberationDashboard.homeScreen = deliberationHomeScreen;
  dashboardManager.registerDashboard('deliberate', committeeDeliberationDashboard);

  const considerDashboard = new ConsiderDashboard(ConsiderDashboard.ID);
  const considerHomeScreen: HomeScreen = new ConsiderationHomeScreen(considerDashboard, CommitteeDeliberationHomeScreen.ID);
  considerDashboard.homeScreen = considerHomeScreen;
  dashboardManager.registerDashboard('consider', considerDashboard);

  // Initialize login dashboard
  const loginDashboard = new LoginDashboard();
  const loginScreen = new LoginScreen(loginDashboard, LoginScreen.ID);
  loginDashboard.homeScreen = loginScreen;
  dashboardManager.registerDashboard('login', loginDashboard);

  // Initialize login forum through renderToTextChannel
  const guild = client.guilds.cache.first();
  if (guild) {
    const loginForumId = process.env.LOGIN_FORUM_CHANNEL_ID || LoginScreen.DEFAULT_FORUM_CHANNEL_ID;
    const loginForumChannel = await guild.channels.fetch(loginForumId);
    if (loginForumChannel && loginForumChannel.type === ChannelType.GuildForum) {
      // We don't actually need to call renderToTextChannel since we're dealing with a forum
      await LoginForumManager.initialize(loginForumId, loginScreen);
    } else {
      logger.error('Login forum channel not found or is not a forum channel');
    }
  }

  // Render initial screen in #admin channel
  if (guild) {
    const adminChannel = guild.channels.cache.find((channel) => channel.name === 'admin') as TextChannel | undefined;
    if (adminChannel) {
      await adminDashboard.homeScreen.renderToTextChannel(adminChannel);
    } else {
      logger.error('Admin channel not found');
    }

    // Render initial screen in #funding-round-init channel
    const fundingRoundInitChannel = guild.channels.cache.find((channel) => channel.name === 'funding-round-init') as TextChannel | undefined;
    if (fundingRoundInitChannel) {
      await fundingRoundInitDashboard.homeScreen.renderToTextChannel(fundingRoundInitChannel);
    } else {
      logger.error('Funding Round Init channel not found');
    }

    // Render initial screen in #propose channel
    const proposeChannel = guild.channels.cache.find((channel) => channel.name === 'propose') as TextChannel | undefined;
    if (proposeChannel) {
      await proposeDashboard.homeScreen.renderToTextChannel(proposeChannel);
    } else {
      logger.error('Propose channel not found');
    }

    // Render initial screen in #deliberate channel
    const deliberateChannel = guild.channels.cache.find((channel) => channel.name === 'deliberate') as TextChannel | undefined;
    if (deliberateChannel) {
      await committeeDeliberationDashboard.homeScreen.renderToTextChannel(deliberateChannel);
    } else {
      logger.error('Deliberate channel not found');
    }

    // Render initial screen in #consider channel
    const considerChannel = guild.channels.cache.find((channel) => channel.name === 'consider') as TextChannel | undefined;
    if (considerChannel) {
      await considerDashboard.homeScreen.renderToTextChannel(considerChannel);
    } else {
      logger.error('Consider channel not found');
    }
  } else {
    logger.error('No guild found');
  }

  // Log IP address and port
  const port = process.env.PORT || 3000;
  const ipAddress = getIPAddress();
  console.info(`Application is running at http://${ipAddress}:${port}`);
  console.info(`API endpoints are accessible at http://${ipAddress}:${port}/api`);
});

client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
  logger.info(`Start handling interaction: ${interaction.isMessageComponent() ? interaction.customId : 'N/A'}`);
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isMessageComponent()) {
      logger.info(`Interaction type not supported: ${interaction.type}`);
      return;
    }

    logger.debug(`Before handling interaction...`);
    await dashboardManager.handleInteraction(interaction);
    logger.debug(`After handling interaction...`);
  } catch (error) {
    logger.debug(`Start handling error in interaction...`);

    try {
      logger.error(error);
      const trackedInteraction = new TrackedInteraction(interaction as AnyInteraction);
      await DiscordStatus.handleException(trackedInteraction, error);
    } catch (error) {
      logger.error(`Unrecoverable error: ${error}`);
    }
  }

  logger.info('Finished handling interaction');
});

function getIPAddress(): string {
  const interfaces = networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return 'localhost';
}

client.login(process.env.DISCORD_TOKEN);
