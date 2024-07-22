// src/channels/admin/screens/HomeScreen.ts

import { Screen, Dashboard, Permission, Action } from '../../../core/BaseClasses';
import { IHomeScreen, RenderOptions } from '../../../types/common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import { ManageSMEGroupsScreen } from './ManageSMEGroupsScreen';


export class AdminHomeScreen extends Screen implements IHomeScreen {
  public static readonly ID = 'home';

  protected permissions: Permission[] = []; // access allowed for all
  protected manageSMEGroupsScreen: ManageSMEGroupsScreen =  new ManageSMEGroupsScreen(this.dashboard, ManageSMEGroupsScreen.ID);

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
      ephemeral: true
    };
  }

  protected allSubScreens(): Screen[] {
    return [
      this.manageSMEGroupsScreen,
    ]
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
        { name: '👥 SME Management', value: 'Manage SME Groups and Users' },
        { name: '📋 Topic Management', value: 'Manage Topics and Committees' },
        { name: '💰 Funding Round Management', value: 'Manage Funding Rounds and Phases' }
      );
  }

  private createActionRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(this.manageSMEGroupsScreen.fullCustomId)
          .setLabel('SME Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId('aaaa') // TODO: replace with correct custom id
          .setLabel('Topic Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋'),
        new ButtonBuilder()
          .setCustomId('aaaaa') // TODO: replace with correct custom id
          .setLabel('Funding Round Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰')
      );
  }
}
