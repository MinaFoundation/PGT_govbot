// src/channels/vote/screens/VoteHomeScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, TextChannel } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { IHomeScreen } from '../../../types/common';
import { FundingRoundSelectionScreen, SelectFundingRoundAction } from './FundingRoundSelectionScreen';

export class VoteHomeScreen extends Screen implements IHomeScreen {
  public static readonly ID = 'voteHome';

  protected permissions: Permission[] = []; // No specific permissions required for voting

  public readonly fundingRoundSelectionScreen: FundingRoundSelectionScreen;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.fundingRoundSelectionScreen = new FundingRoundSelectionScreen(dashboard, FundingRoundSelectionScreen.ID);
  }

  public async renderToTextChannel(channel: TextChannel): Promise<void> {
    const content = await this.getResponse();
    await channel.send(content);
  }

  protected allSubScreens(): Screen[] {
    return [this.fundingRoundSelectionScreen];
  }

  protected allActions(): Action[] {
    return [];
  }

  protected async getResponse(interaction?: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Welcome to Voting')
      .setDescription('Here you can participate in the voting process for funding rounds and projects.')
      .addFields(
        { name: 'Funding Round Voting', value: 'Vote to approve or reject proposed funding rounds.' },
        { name: 'Project Voting', value: 'Vote on projects within approved funding rounds across different phases:' },
        { name: 'Consideration Phase', value: 'Vote to move projects from Consideration to Deliberation.' },
        { name: 'Deliberation Phase', value: 'Submit reasoning for why a project should be funded.' },
        { name: 'Funding Voting Phase', value: 'Vote on which projects should receive funding.' }
      )
      .setFooter({ text: 'Select a funding round to begin the voting process.' });

    const selectFundingRoundButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.generateCustomId(this.dashboard, this.fundingRoundSelectionScreen, this.fundingRoundSelectionScreen.selectFundingRoundAction, SelectFundingRoundAction.OPERATIONS.showFundingRounds))
      .setLabel('Select Funding Round')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      .addComponents(selectFundingRoundButton);

    const components = [row];

    if (args?.successMessage) {
      const successEmbed = new EmbedBuilder()
        .setColor('#28a745')
        .setDescription(args.successMessage);
      return {
        embeds: [embed, successEmbed],
        components,
        ephemeral: true
      };
    } else if (args?.errorMessage) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#dc3545')
        .setDescription(args.errorMessage);
      return {
        embeds: [embed, errorEmbed],
        components,
        ephemeral: true
      };
    }

    return {
      embeds: [embed],
      components,
      ephemeral: true
    };
  }
}