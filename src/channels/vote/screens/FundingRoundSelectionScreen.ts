// src/channels/vote/screens/FundingRoundSelectionScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { FundingRound } from '../../../models';
import { FundingRoundStatus } from '../../../types';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { InteractionProperties } from '../../../core/Interaction';
import { FundingRoundVotingScreen, MemberVoteFundingRoundAction } from './FundingRoundVotingScreen';
import { ProjectVotingScreen, SelectProjectAction } from './ProjectVotingScreen';
import { FundingRoundLogic } from '../../admin/screens/FundingRoundLogic';

export class FundingRoundSelectionScreen extends Screen {
  public static readonly ID = 'fundingRoundSelection';

  protected permissions: Permission[] = [];

  public readonly selectFundingRoundAction: SelectFundingRoundAction;
  public readonly fundingRoundVotingScreen: FundingRoundVotingScreen;
  public readonly projectVotingScreen: ProjectVotingScreen;
  public readonly voteFundingRoundAction: MemberVoteFundingRoundAction;
  public readonly selectProjectAction: SelectProjectAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.selectFundingRoundAction = new SelectFundingRoundAction(this, SelectFundingRoundAction.ID);
    this.fundingRoundVotingScreen = new FundingRoundVotingScreen(dashboard, FundingRoundVotingScreen.ID);
    this.projectVotingScreen = new ProjectVotingScreen(dashboard, ProjectVotingScreen.ID);
    this.voteFundingRoundAction = new MemberVoteFundingRoundAction(this, MemberVoteFundingRoundAction.ID);
    this.selectProjectAction = new SelectProjectAction(this, SelectProjectAction.ID);
  }

  protected allSubScreens(): Screen[] {
    return [this.fundingRoundVotingScreen, this.projectVotingScreen];
  }

  protected allActions(): Action[] {
    return [this.selectFundingRoundAction, this.voteFundingRoundAction];
  }

  protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Select a Funding Round')
      .setDescription('Choose an eligible funding round to vote on:');

    const selectFundingRoundButton = this.selectFundingRoundAction.getComponent();

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      .addComponents(selectFundingRoundButton);

    return {
      embeds: [embed],
      components: [row],
      ephemeral: true
    };
  }
}

export class SelectFundingRoundAction extends PaginationComponent {
  public static readonly ID = 'selectFundingRound';

  public static readonly OPERATIONS = {
    showFundingRounds: 'showFundingRounds',
    selectFundingRound: 'selectFundingRound',
    paginate: 'paginate'
  };

  protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const eligibleFundingRounds = await FundingRoundLogic.getVotingAndApprovedFundingRounds();
    return Math.ceil(eligibleFundingRounds.length / 25);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
    const eligibleFundingRounds = await FundingRoundLogic.getVotingAndApprovedFundingRounds();
    return eligibleFundingRounds.slice(page * 25, (page + 1) * 25);
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case SelectFundingRoundAction.OPERATIONS.showFundingRounds:
        await this.handleShowFundingRounds(interaction);
        break;
      case SelectFundingRoundAction.OPERATIONS.selectFundingRound:
        await this.handleSelectFundingRound(interaction);
        break;
      case SelectFundingRoundAction.OPERATIONS.paginate:
        await this.handlePagination(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const fundingRounds = await this.getItemsForPage(interaction, currentPage);

    if (fundingRounds.length === 0) {
      await interaction.respond({ content: 'There are no eligible funding rounds for voting at the moment.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Select a Funding Round')
      .setDescription(`To proceed, please select a Funding Round from the list below.\nPage ${currentPage + 1} of ${totalPages}`);

    const options = fundingRounds.map(fr => ({
      label: fr.name,
      value: fr.id.toString(),
      description: `Status: ${fr.status}, Budget: ${fr.budget}`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectFundingRoundAction.OPERATIONS.selectFundingRound))
      .setPlaceholder('Select a Funding Round')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [row];

    if (totalPages > 1) {
      const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
      components.push(paginationRow);
    }

    await interaction.respond({ embeds: [embed], components, ephemeral: true });
  }

  private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
      return;
    }

    const fundingRoundId = parseInt(interactionWithValues.values[0]);
    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

    if (!fundingRound) {
      await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
      return;
    }

    interaction.Context.set('fundingRoundId', fundingRoundId.toString());
    if (fundingRound.status === FundingRoundStatus.VOTING) {
        await (this.screen as FundingRoundSelectionScreen).voteFundingRoundAction.handleOperation(
            interaction,
            MemberVoteFundingRoundAction.OPERATIONS.showVoteOptions,
            { fundingRoundId }
        );
    } else if (fundingRound.status === FundingRoundStatus.APPROVED) {
      await (this.screen as FundingRoundSelectionScreen).projectVotingScreen.render(interaction);
    } else {
      await interaction.respond({ content: 'This funding round is not currently open for voting.', ephemeral: true });
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'showFundingRounds'))
      .setLabel('Select Funding Round')
      .setStyle(ButtonStyle.Primary);
  }
}