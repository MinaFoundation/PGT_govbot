import { CacheType, Client, GatewayIntentBits, Interaction, TextChannel } from 'discord.js';
import { config } from 'dotenv';
import { DashboardManager } from './core/DashboardManager';
import { AdminDashboard } from './channels/admin/dashboard';
import { syncDatabase } from './models';
import { AdminHomeScreen } from './channels/admin/screens/AdminHomeScreen';
import { HomeScreen } from './types/common';

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

  // Render initial screen in #admin channel
  const guild = client.guilds.cache.first();
  if (guild) {
    const adminChannel = guild.channels.cache.find(channel => channel.name === 'admin') as TextChannel | undefined;
    if (adminChannel) {
      await adminDashboard.homeScreen.renderToTextChannel(adminChannel);
    } else {
      console.error('Admin channel not found');
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