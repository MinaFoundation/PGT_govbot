import { ButtonInteraction } from 'discord.js';
import { viewSMEs } from './commands/smeCommands';

export async function handleButtonInteraction(interaction: ButtonInteraction) {
    const { customId } = interaction;

    try {
        switch (customId) {
            case 'addSMECategory':
                // TODO
                break;
            case 'addSME':
                // TODO
                break;
            case 'removeSME':
                // TODO
                break;
            case 'viewSMEs':
                const smes = await viewSMEs();
                await interaction.reply({ content: JSON.stringify(smes, null, 2), ephemeral: true });
                break;
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Error while processing the action :/', ephemeral: true });
    }
}