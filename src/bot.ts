import { CacheType, Client, GatewayIntentBits, Interaction, TextChannel } from 'discord.js';
import { config } from 'dotenv';
import { DashboardManager } from './core/DashboardManager';
import { AdminDashboard } from './channels/admin/dashboard';
import { syncDatabase } from './models';
import { AdminHomeScreen } from './channels/admin/screens/AdminHomeScreen';
import { HomeScreen } from './types/common';
import { FundingRoundInitDashboard } from './channels/funding-round-init/FundingRoundInitDashboard';
import { FundingRoundInitScreen } from './channels/funding-round-init/screens/FundingRoundInitScreen';
import { ProposeDashboard } from './channels/propose/ProposeDashboard';
import { ProposalHomeScreen } from './channels/propose/screens/ProposalHomeScreen';

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const dashboardManager = new DashboardManager();

client.once('ready', async () => {
  console.log('Bot is ready!');
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
  const proposeHomeScreen: HomeScreen = new ProposalHomeScreen(proposeDashboard, ProposalHomeScreen.ID);
  proposeDashboard.homeScreen = proposeHomeScreen;
  dashboardManager.registerDashboard('propose', proposeDashboard);


  // Render initial screen in #admin channel
  const guild = client.guilds.cache.first();
  if (guild) {
    const adminChannel = guild.channels.cache.find(channel => channel.name === 'admin') as TextChannel | undefined;
    if (adminChannel) {
      await adminDashboard.homeScreen.renderToTextChannel(adminChannel);
    } else {
      console.error('Admin channel not found');
    }

    // Render initial screen in #funding-round-init channel
    const fundingRoundInitChannel = guild.channels.cache.find(channel => channel.name === 'funding-round-init') as TextChannel | undefined;
    if (fundingRoundInitChannel) {
      await fundingRoundInitDashboard.homeScreen.renderToTextChannel(fundingRoundInitChannel);
    } else {
      console.error('Funding Round Init channel not found');
    }


    // Render initial screen in #propose channel
    const proposeChannel = guild.channels.cache.find(channel => channel.name === 'propose') as TextChannel | undefined;
    if (proposeChannel) {
      await proposeDashboard.homeScreen.renderToTextChannel(proposeChannel);
    } else {
      console.error('Propose channel not found');
    }
  } else {
    console.error('No guild found');
  }

  // Register other dashboards here
});

client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isMessageComponent()){
    console.log(`Interaction type not supported: ${interaction.type}`);
    return;
  }

  await dashboardManager.handleInteraction(interaction);
});

client.login(process.env.DISCORD_TOKEN);