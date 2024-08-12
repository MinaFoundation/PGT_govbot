import { CacheType, Client, GatewayIntentBits, Interaction, TextChannel } from 'discord.js';
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

config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const dashboardManager = new DashboardManager();

client.once('ready', async () => {
  logger.info('Bot is ready!');
  await syncDatabase();

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


  // Render initial screen in #admin channel
  const guild = client.guilds.cache.first();
  if (guild) {
    const adminChannel = guild.channels.cache.find(channel => channel.name === 'admin') as TextChannel | undefined;
    if (adminChannel) {
      await adminDashboard.homeScreen.renderToTextChannel(adminChannel);
    } else {
      logger.error('Admin channel not found');
    }

    // Render initial screen in #funding-round-init channel
    const fundingRoundInitChannel = guild.channels.cache.find(channel => channel.name === 'funding-round-init') as TextChannel | undefined;
    if (fundingRoundInitChannel) {
      await fundingRoundInitDashboard.homeScreen.renderToTextChannel(fundingRoundInitChannel);
    } else {
      logger.error('Funding Round Init channel not found');
    }


    // Render initial screen in #propose channel
    const proposeChannel = guild.channels.cache.find(channel => channel.name === 'propose') as TextChannel | undefined;
    if (proposeChannel) {
      await proposeDashboard.homeScreen.renderToTextChannel(proposeChannel);
    } else {
      logger.error('Propose channel not found');
    }

    // Render initial screen in #vote channel
    const voteChannel = guild.channels.cache.find(channel => channel.name === 'vote') as TextChannel | undefined;
    if (voteChannel) {
      await voteDashboard.homeScreen.renderToTextChannel(voteChannel);
    } else {
      logger.error('Vote channel not found');
    }

    // Render initial screen in #deliberate channel
    const deliberateChannel = guild.channels.cache.find(channel => channel.name === 'deliberate') as TextChannel | undefined;
    if (deliberateChannel) {
      await committeeDeliberationDashboard.homeScreen.renderToTextChannel(deliberateChannel);
    } else {
      logger.error('Deliberate channel not found');
    }

    // Render initial screen in #consider channel
    const considerChannel = guild.channels.cache.find(channel => channel.name === 'consider') as TextChannel | undefined;
    if (considerChannel) {
      await considerDashboard.homeScreen.renderToTextChannel(considerChannel);
    } else {
      logger.error('Consider channel not found');
    }

  } else {
    logger.error('No guild found');
  }

  // Register other dashboards here
});

client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
  try {

  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isMessageComponent()){
    logger.info(`Interaction type not supported: ${interaction.type}`);
    return;
  }

  await dashboardManager.handleInteraction(interaction);
} catch (error) {
    logger.error(error);
    const trackedInteratction = new TrackedInteraction(interaction as AnyInteraction);
    await DiscordStatus.handleException(trackedInteratction, error);
  }
});

client.login(process.env.DISCORD_TOKEN);