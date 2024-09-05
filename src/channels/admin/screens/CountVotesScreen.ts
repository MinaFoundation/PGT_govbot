import { Screen, Dashboard, Permission, Action, TrackedInteraction } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { CountVotesAction } from '../actions/CountVotesAction';
import { CustomIDOracle } from '../../../CustomIDOracle';

export class CountVotesScreen extends Screen {
  public static readonly ID = 'countVotes';
  protected permissions: Permission[] = [];
  private countVotesAction: CountVotesAction;

  constructor(dashboard: Dashboard, id: string) {
    super(dashboard, id);
    this.countVotesAction = new CountVotesAction(this, CountVotesAction.ID);
  }

  async getResponse(interaction: TrackedInteraction): Promise<any> {
    const embed = new EmbedBuilder().setColor('#0099ff').setTitle('Count Votes').setDescription('Select a funding round to count votes for:');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(this.countVotesAction, 'selectFundingRound'))
        .setLabel('Select Funding Round')
        .setStyle(ButtonStyle.Primary),
    );

    return {
      embeds: [embed],
      components: [row],
      ephemeral: true,
    };
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [this.countVotesAction];
  }
}
