// src/channels/vote/screens/FundingRoundVotingScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { VoteLogic } from '../../../logic/VoteLogic';
import { FundingRound } from '../../../models';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { InteractionProperties } from '../../../core/Interaction';
import { FundingRoundLogic } from '../../admin/screens/FundingRoundLogic';

export class FundingRoundVotingScreen extends Screen {
  public static readonly ID = 'fundingRoundVoting';

  protected permissions: Permission[] = []; // No specific permissions required for voting

  public readonly selectFundingRoundAction: SelectFundingRoundAction;
  public readonly voteFundingRoundAction: MemberVoteFundingRoundAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.selectFundingRoundAction = new SelectFundingRoundAction(this, SelectFundingRoundAction.ID);
    this.voteFundingRoundAction = new MemberVoteFundingRoundAction(this, MemberVoteFundingRoundAction.ID);
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [
      this.selectFundingRoundAction,
      this.voteFundingRoundAction,
    ];
  }

  protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Vote on Funding Rounds')
      .setDescription('Select a funding round to vote on:');

    const selectFundingRoundButton = this.selectFundingRoundAction.getComponent();

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

class SelectFundingRoundAction extends PaginationComponent {
  public static readonly ID = 'selectFundingRound';

  public static readonly OPERATIONS = {
    showFundingRounds: 'showFundingRounds',
    selectFundingRound: 'selectFundingRound',
    paginate: 'paginate'
  };

  protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const eligibleFundingRounds = await FundingRoundLogic.getEligibleVotingRounds();
    return Math.ceil(eligibleFundingRounds.length / 25);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
    const eligibleFundingRounds = await FundingRoundLogic.getEligibleVotingRounds();
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

  public async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
      return;
    }

    const fundingRoundId = parseInt(interactionWithValues.values[0]);
    await (this.screen as FundingRoundVotingScreen).voteFundingRoundAction.handleOperation(
      interaction,
      'showVoteOptions',
      { fundingRoundId }
    );
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectFundingRoundAction.OPERATIONS.showFundingRounds))
      .setLabel('Select Funding Round')
      .setStyle(ButtonStyle.Primary);
  }
}

export class MemberVoteFundingRoundAction extends Action {
  public static readonly ID = 'voteFundingRound';

  public static readonly OPERATIONS = {
    showVoteOptions: 'showVoteOptions',
    vote: 'vote',
    unvote: 'unvote'
  };

  public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
    switch (operationId) {
      case MemberVoteFundingRoundAction.OPERATIONS.showVoteOptions:
        await this.handleShowVoteOptions(interaction, args);
        break;
      case MemberVoteFundingRoundAction.OPERATIONS.vote:
        await this.handleVote(interaction);
        break;
      case MemberVoteFundingRoundAction.OPERATIONS.unvote:
        await this.handleUnvote(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowVoteOptions(interaction: TrackedInteraction, args: { fundingRoundId: number }): Promise<void> {
    const { fundingRoundId } = args;
    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

    if (!fundingRound) {
      await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Vote on Funding Round: ${fundingRound.name}`)
      .setDescription('You can vote on-chain to approve or reject this funding round.')
      .addFields(
        { name: 'Budget', value: fundingRound.budget.toString(), inline: true },
        { name: 'Voting Open Until', value: fundingRound.votingOpenUntil?.toLocaleString() || 'Not set', inline: true },
        { name: 'Voting Address', value: fundingRound.votingAddress, inline: true }
      );

    const voteButton = new ButtonBuilder()
      .setLabel('Vote For Approval (Vote) ✅')
      .setURL(`https://example.com/vote?address=${fundingRound.votingAddress}`) // Replace with actual voting page URL
      .setStyle(ButtonStyle.Link);

    const unvoteButton = new ButtonBuilder()
      .setLabel('Vote For Rejection (Unvote) ❌')
      .setURL(`https://example.com/unvote?address=${fundingRound.votingAddress}`) // Replace with actual voting page URL
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton, unvoteButton);

    await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
  }

  private async handleUnvote(interaction: TrackedInteraction): Promise<void> {
    const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId') || '');
    const userId = interaction.interaction.user.id;

    try {
      await VoteLogic.unvoteFundingRound(userId, fundingRoundId);
      await interaction.respond({ content: 'Please ', ephemeral: true });
    } catch (error) {
      await interaction.respond({ content: `Error removing vote: ${error instanceof Error ? error.message : 'Unknown error'}`, ephemeral: true });
    }
  }

  private async handleVote(interaction: TrackedInteraction): Promise<void> {
    const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId') || '');
    const userId = interaction.interaction.user.id;

    try {
      await VoteLogic.voteFundingRound(userId, fundingRoundId);
      await interaction.respond({ content: 'Your vote has been recorded successfully.', ephemeral: true });
    } catch (error) {
      await interaction.respond({ content: `Error recording vote: ${error instanceof Error ? error.message : 'Unknown error'}`, ephemeral: true });
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(fundingRoundId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'showVoteOptions', 'fundingRoundId', fundingRoundId.toString()))
      .setLabel('Vote on Funding Round')
      .setStyle(ButtonStyle.Primary);
  }
}
  