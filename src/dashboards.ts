import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SMECustomIDs } from './constants';

export async function setupDashboards(client: Client) {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const category = guild.channels.cache.find(ch => ch.name === 'govbot' && ch.type === 4); // 4 == type for category channels
    if (!category) return;

    const smeChannel = guild.channels.cache.find(ch => ch.name === 'sme-management' && ch.parentId === category.id) as TextChannel;
    // TODO: other channels

    if (smeChannel) await setupSMEDashboard(smeChannel);
    // TODO: other channels
}

// TODO: below should only be visible to admins. [[ Hardcode admins as specific user IDs?]]
async function setupSMEDashboard(channel: TextChannel) {
    const embed = new EmbedBuilder()
        .setTitle('SME Management Dashboard')
        .setDescription('Manage Subject Matter Experts (SMEs) here.')
        .setColor(0x0099FF); // blue

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(SMECustomIDs.ADD_SME_CATEGORY)
                .setLabel('Add SME Category')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(SMECustomIDs.ADD_SME)
                .setLabel('Add SME')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(SMECustomIDs.REMOVE_SME)
                .setLabel('Remove SME')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(SMECustomIDs.VIEW_SMES)
                .setLabel('View SMEs')
                .setStyle(ButtonStyle.Secondary)
        );

    await channel.send({ embeds: [embed], components: [row] });
}
