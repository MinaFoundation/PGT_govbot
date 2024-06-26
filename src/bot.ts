import { Client, GatewayIntentBits, Interaction} from 'discord.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import { setupDashboards } from './dashboards';
import { handleButtonInteraction } from './buttonHandlers';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', async () => {
    console.log('Bot is ready!');
    await initializeDatabase();
    // TODO: create channels here if they are to be created automatically
    await setupDashboards(client);
});

client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    await handleButtonInteraction(interaction);
});

client.login(process.env.DISCORD_TOKEN);