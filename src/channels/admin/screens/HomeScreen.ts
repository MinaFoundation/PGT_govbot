// src/channels/admin/screens/HomeScreen.ts

import { Screen, Action, Dashboard } from '../../../core/BaseClasses';
import { AnyInteraction, PermissionChecker, RenderOptions } from '../../../types/common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import { InteractionProperties } from '../../../core/Interaction';

export class HomeScreen extends Screen {
  static readonly SCREEN_ID = 'home';

  constructor(dashboard: Dashboard, viewPermission: PermissionChecker) {
    super(dashboard, viewPermission);
    this.registerAction(new SMEManagementAction(this));
    this.registerAction(new TopicManagementAction(this));
    this.registerAction(new FundingRoundManagementAction(this));
  }

  async render(options: RenderOptions): Promise<void> {
    super.render(options);
    
    const { interaction } = options;

    const embed = this.createEmbed();
    const row = this.createActionRow();

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  async renderInitial(channel: TextChannel): Promise<void> {
    const embed = this.createEmbed();
    const row = this.createActionRow();

    await channel.send({
      embeds: [embed],
      components: [row],
    });
  }

  private createEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🛠️ Admin Dashboard')
      .setDescription('Welcome to the Admin Dashboard. Please select a category to manage:')
      .addFields(
        { name: '👥 SME Management', value: 'Manage SME Groups and Users' },
        { name: '📋 Topic Management', value: 'Manage Topics and Committees' },
        { name: '💰 Funding Round Management', value: 'Manage Funding Rounds and Phases' }
      );
  }

  private createActionRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(HomeScreen.generateCustomId('smeManagement'))
          .setLabel('SME Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId(HomeScreen.generateCustomId('topicManagement'))
          .setLabel('Topic Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋'),
        new ButtonBuilder()
          .setCustomId(HomeScreen.generateCustomId('fundingRoundManagement'))
          .setLabel('Funding Round Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰')
      );
  }
}

class SMEManagementAction extends Action {
    static readonly ACTION_ID = 'smeManagement';
  
    async execute(interaction: AnyInteraction): Promise<void> {
      const smeManagementScreen = this.screen.dashboard.getScreen('smeManagement') as Screen;
      await smeManagementScreen.render({ interaction });
    }
  }


class TopicManagementAction extends Action {
  static readonly ACTION_ID = 'topicManagement';

  async execute(interaction: AnyInteraction): Promise<void> {

    const parsedInteraction = InteractionProperties.toUpdateableOrUndefined(interaction);
    if (!parsedInteraction) {
        await interaction.reply({ content: 'Error: Unsupported interaction.', ephemeral: true });
        return;
    }


    // Implement Topic Management options
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 Topic Management')
      .setDescription('Select an action to perform:');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(Screen.generateCustomId('addRemoveTopics'))
          .setLabel('Add/Remove Topics')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(Screen.generateCustomId('setRequiredSMEs'))
          .setLabel('Set Required SMEs')
          .setStyle(ButtonStyle.Secondary)
      );

    await parsedInteraction.update({
      embeds: [embed],
      components: [row],
    });
  }
}

class FundingRoundManagementAction extends Action {
  static readonly ACTION_ID = 'fundingRoundManagement';

  async execute(interaction: AnyInteraction): Promise<void> {

    const parsedInteraction = InteractionProperties.toUpdateableOrUndefined(interaction);
    if (!parsedInteraction) {
        await interaction.reply({ content: 'Error: Unsupported interaction.', ephemeral: true });
        return;
    }

    // Implement Funding Round Management options
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('💰 Funding Round Management')
      .setDescription('Select an action to perform:');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(Screen.generateCustomId('setCommittee'))
          .setLabel('Set Committee')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(Screen.generateCustomId('approveRejectFundingRound'))
          .setLabel('Approve/Reject Funding Round')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(Screen.generateCustomId('manageFundingRoundPhases'))
          .setLabel('Manage Funding Round Phases')
          .setStyle(ButtonStyle.Secondary)
      );

    await parsedInteraction.update({
      embeds: [embed],
      components: [row],
    });
  }
}
