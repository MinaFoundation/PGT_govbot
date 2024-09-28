// src/channels/admin/screens/HomeScreen.ts

import { Screen, Dashboard, Permission, Action } from '../../../core/BaseClasses';
import { IHomeScreen, RenderOptions } from '../../../types/common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import { ManageSMEGroupsScreen } from './ManageSMEGroupsScreen';
import { ManageTopicsScreen } from './ManageTopicLogicScreen';
import { ManageFundingRoundsScreen } from './ManageFundingRoundsScreen';
import { ManageProposalStatusesScreen } from './ManageProposalStatusesScreen';
import { CountVotesScreen } from './CountVotesScreen';

export class AdminHomeScreen extends Screen implements IHomeScreen {
  public static readonly ID = 'home';

  protected permissions: Permission[] = []; // access allowed for all
  protected manageSMEGroupsScreen: ManageSMEGroupsScreen = new ManageSMEGroupsScreen(this.dashboard, ManageSMEGroupsScreen.ID);
  protected manageTopicsScreen: ManageTopicsScreen = new ManageTopicsScreen(this.dashboard, ManageTopicsScreen.ID);
  protected manageFundingRoundsScreen: ManageFundingRoundsScreen = new ManageFundingRoundsScreen(this.dashboard, ManageFundingRoundsScreen.ID);
  protected manageProposalStatusesScreen: ManageProposalStatusesScreen = new ManageProposalStatusesScreen(
    this.dashboard,
    ManageProposalStatusesScreen.ID,
  );
  protected countVotesScreen: CountVotesScreen = new CountVotesScreen(this.dashboard, CountVotesScreen.ID);

  async renderToTextChannel(channel: TextChannel): Promise<void> {
    const embed = this.createEmbed();
    const row = this.createActionRow();

    await channel.send({
      embeds: [embed],
      components: [row],
    });
  }

  async getResponse(options: RenderOptions): Promise<any> {
    const { interaction } = options;

    const embed = this.createEmbed();
    const row = this.createActionRow();

    return {
      embeds: [embed],
      components: [row],
      ephemeral: true,
    };
  }

  protected allSubScreens(): Screen[] {
    return [this.manageSMEGroupsScreen, this.manageTopicsScreen, this.manageFundingRoundsScreen, this.countVotesScreen];
  }
  protected allActions(): Action[] {
    return [];
  }

  private createEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🛠️ Admin Dashboard')
      .setDescription('Welcome to the Admin Dashboard. Please select a category to manage:')
      .addFields(
        { name: '👥 Manage Reviewers', value: 'Manage Reviewers and Users' },
        { name: '📋 Manage Discussion Topics', value: 'Manage Discussion Topics and Committees' },
        { name: '💰 Manage Funding Rounds', value: 'Manage Funding Rounds and Phases' },
      );
  }

  private createActionRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(this.manageSMEGroupsScreen.fullCustomId)
        .setLabel('Manage Reviewers ')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥'),
      new ButtonBuilder()
        .setCustomId(this.manageTopicsScreen.fullCustomId)
        .setLabel('Manage Discussion Topics')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId(this.manageFundingRoundsScreen.fullCustomId)
        .setLabel('Manage Funding Rounds')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId(this.manageProposalStatusesScreen.fullCustomId)
        .setLabel('Manage Proposal Status')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder().setCustomId(this.countVotesScreen.fullCustomId).setLabel('Count Votes').setStyle(ButtonStyle.Primary).setEmoji('🗳️'),
    );
  }
}
