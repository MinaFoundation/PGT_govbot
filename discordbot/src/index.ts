import 'dotenv/config'
import { createClient } from 'redis';

import { Client, GatewayIntentBits, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } from '@discordjs/builders';
import { createClient } from 'redis';

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Unhandled exception:', error);
});

(async() => {

  console.log('making client');

  const is_dev = process.argv[2] == '--dev';

  const prefix = is_dev ? 'dev_' : '';

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  const command = 
    new SlashCommandBuilder()
    .setName(prefix + 'govbot')
    .setDescription('tools for community decision making')
    .addSubcommand(sc => 
      sc
        .setName('add-sme-category')
        .setDescription('Create a new category for subject matter experts to belong to')
    )

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [ command.toJSON() ] },
    );
    console.log('Successfully registered commands.');
  } catch (error) {
    console.error('Error registering commands', error);
  }

  client.once('ready', () => console.log('ready'));

  client.on('interactionCreate', async interaction => {
    console.log(interaction);

  });

  client.login(process.env.DISCORD_TOKEN);

})();
