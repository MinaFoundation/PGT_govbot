// src/channels/consideration/screens/ConsiderationHomeScreen.ts

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ORMModelPaginator, PaginationComponent } from '../../../components/PaginationComponent';
import { Action, Dashboard, Permission, RenderArgs, Screen, TrackedInteraction } from '../../../core/BaseClasses';
import { InteractionProperties } from '../../../core/Interaction';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { ConsiderationLogic } from '../../../logic/ConsiderationLogic';
import { FundingRound, Proposal } from '../../../models';
import { IHomeScreen } from '../../../types/common';
import { CONSIDERATION_CONSTANTS } from '../Constants';
import { EndUserError } from '../../../Errors';
import { ConsiderationFundingRoundPaginator } from '../../../components/FundingRoundPaginator';
import { DiscordLimiter } from '../../../utils/DiscordLimiter';
import { GenerateLoginTokenAction } from '../actions/GenerateLoginTokenAction';

export class ConsiderationHomeScreen extends Screen implements IHomeScreen {
  public static readonly ID = CONSIDERATION_CONSTANTS.SCREEN_IDS.HOME;

  protected permissions: Permission[] = [];

  public readonly selectFundingRoundAction: SelectFundingRoundAction;
  public readonly selectVoteTypeAction: SelectVoteTypeAction;
  public readonly selectProjectAction: SelectProjectAction;
  public readonly smeConsiderationVoteAction: SMEConsiderationVoteAction;
  public readonly generateLoginTokenAction: GenerateLoginTokenAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.selectFundingRoundAction = new SelectFundingRoundAction(this, CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_FUNDING_ROUND);
    this.selectVoteTypeAction = new SelectVoteTypeAction(this, CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_VOTE_TYPE);
    this.selectProjectAction = new SelectProjectAction(this, CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_PROJECT);
    this.smeConsiderationVoteAction = new SMEConsiderationVoteAction(this, CONSIDERATION_CONSTANTS.ACTION_IDS.SME_CONSIDERATION_VOTE);
    this.generateLoginTokenAction = new GenerateLoginTokenAction(this, CONSIDERATION_CONSTANTS.ACTION_IDS.GENERATE_LOGIN_TOKEN);
  }

  public async renderToTextChannel(channel: TextChannel): Promise<void> {
    const content = await this.getResponse();
    await channel.send(content);
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [
      this.selectFundingRoundAction,
      this.selectVoteTypeAction,
      this.selectProjectAction,
      this.smeConsiderationVoteAction,
      this.generateLoginTokenAction,
    ];
  }

  protected async getResponse(interaction?: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Proposal Consideration Phase')
      .setDescription(
        'Here, selected subject matter experts can vote on the Consideration phase of the proposals in the Funding Round. Begin by selecting a funding round, by pressing the "Select Funding Round" button below.',
      );

    const selectFundingRoundButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this.selectFundingRoundAction, CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_FUNDING_ROUNDS))
      .setLabel('Select Funding Round')
      .setStyle(ButtonStyle.Primary);

    const loginButton = this.generateLoginTokenAction.getComponent();

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectFundingRoundButton, loginButton);

    return {
      embeds: [embed],
      components: [row],
      ephemeral: true,
    };
  }
}

class SelectFundingRoundAction extends Action {
  public static readonly ID = CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_FUNDING_ROUND;

  private readonly considerationFundingRoundPaginator: ConsiderationFundingRoundPaginator;

  constructor(screen: Screen, actionId: string) {
    super(screen, actionId);
    this.considerationFundingRoundPaginator = new ConsiderationFundingRoundPaginator(
      this.screen,
      this,
      CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_FUNDING_ROUND,
      ConsiderationFundingRoundPaginator.ID,
    );
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_FUNDING_ROUNDS:
      case PaginationComponent.PAGINATION_ARG:
        await this.handleShowFundingRounds(interaction);
        break;
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_FUNDING_ROUND:
        await this.handleSelectFundingRound(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
    await this.considerationFundingRoundPaginator.handlePagination(interaction);
  }

  private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      throw new EndUserError('Invalid interaction type.');
    }

    const fundingRoundId = parseInt(interactionWithValues.values[0]);
    await (this.screen as ConsiderationHomeScreen).selectVoteTypeAction.handleOperation(
      interaction,
      CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_VOTE_TYPES,
      { fundingRoundId },
    );
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_FUNDING_ROUNDS,
          ORMModelPaginator.BOOLEAN.ARGUMENTS.FORCE_REPLY,
          ORMModelPaginator.BOOLEAN.TRUE,
        ),
      )
      .setLabel('Select Funding Round')
      .setStyle(ButtonStyle.Primary);
  }
}

class SelectVoteTypeAction extends Action {
  public static readonly ID = CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_VOTE_TYPE;

  public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
    switch (operationId) {
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_VOTE_TYPES:
        await this.handleShowVoteTypes(interaction, args);
        break;
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_VOTE_TYPE:
        await this.handleSelectVoteType(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowVoteTypes(interaction: TrackedInteraction, args: { fundingRoundId: number }): Promise<void> {
    const { fundingRoundId } = args;
    const fundingRound = await FundingRound.findByPk(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found.');
    }

    const userId = interaction.interaction.user.id;
    const unvotedProposalsCount = await ConsiderationLogic.getUnvotedProposalsCount(fundingRoundId, userId);
    const hasVotedProposals = await ConsiderationLogic.hasVotedProposals(fundingRoundId, userId);

    const embed = new EmbedBuilder().setColor('#0099ff').setTitle(`You're Considering On ${fundingRound.name}`)
      .setDescription(`Here, you can submit your approval & rejection votes on the projects in ${fundingRound.name}.
                       You can add a new vote or change an existing one.

                       Your votes in this phase play a crucial role in the selection of the projects that will move to the next phase (Deliberation).

                       To begin, select whether you would like to cast a new vote or change an existing one.`);

    if (unvotedProposalsCount > 0) {
      embed.addFields({
        name: 'INBOX',
        value: `You still have ${unvotedProposalsCount} proposals to vote on until ${fundingRound.endAt.toLocaleString()}`,
      });
    }

    const evaluateNewProposalsButton = new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_VOTE_TYPE,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE_TYPE,
          'new',
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
        ),
      )
      .setLabel(`Evaluate New Proposals (${unvotedProposalsCount} left)`)
      .setStyle(unvotedProposalsCount > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(unvotedProposalsCount === 0);

    const updatePreviousVoteButton = new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_VOTE_TYPE,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE_TYPE,
          'change',
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
        ),
      )
      .setLabel('Update Previous Vote')
      .setStyle(hasVotedProposals ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!hasVotedProposals);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(evaluateNewProposalsButton, updatePreviousVoteButton);

    await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
  }

  private async handleSelectVoteType(interaction: TrackedInteraction): Promise<void> {
    const voteType = CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE_TYPE);
    const fundingRoundIdRaw: string | undefined = CustomIDOracle.getNamedArgument(
      interaction.customId,
      CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
    );
    if (!fundingRoundIdRaw) {
      throw new EndUserError('fundingRoundId not provided in customId.');
    }
    const fundingRoundId = parseInt(fundingRoundIdRaw);

    if (voteType === 'new') {
      await (this.screen as ConsiderationHomeScreen).selectProjectAction.handleOperation(
        interaction,
        CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_PROJECTS,
        { fundingRoundId, showUnvoted: true },
      );
    } else if (voteType === 'change') {
      await (this.screen as ConsiderationHomeScreen).selectProjectAction.handleOperation(
        interaction,
        CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_PROJECTS,
        { fundingRoundId, showUnvoted: false },
      );
    } else {
      throw new EndUserError('Invalid vote type selected.');
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    throw new EndUserError('SelectVoteTypeAction does not have a standalone component.');
  }
}

class SelectProjectAction extends PaginationComponent {
  public static readonly ID = CONSIDERATION_CONSTANTS.ACTION_IDS.SELECT_PROJECT;

  protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const fundingRoundId = parseInt(
      CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID) || '',
    );
    const showUnvoted = CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.SHOW_UNVOTED) === 'true';
    const projects = await ConsiderationLogic.getEligibleProjects(fundingRoundId, interaction.interaction.user.id, showUnvoted);
    return Math.ceil(projects.length / 25);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number, showUnvoted?: boolean): Promise<Proposal[]> {
    const fundingRoundId = parseInt(
      CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID) || '',
    );

    let finalShowUnvoted: boolean = false;
    if (showUnvoted === undefined) {
      const showUnvotedRawArg: string | undefined = CustomIDOracle.getNamedArgument(
        interaction.customId,
        CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.SHOW_UNVOTED,
      );

      if (showUnvotedRawArg) {
        finalShowUnvoted = showUnvotedRawArg === 'true';
      }
    } else {
      finalShowUnvoted = showUnvoted;
    }

    const projects = await ConsiderationLogic.getEligibleProjects(fundingRoundId, interaction.interaction.user.id, finalShowUnvoted);
    return projects.slice(page * 25, (page + 1) * 25);
  }

  public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
    switch (operationId) {
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_PROJECTS:
        await this.handleShowProjects(interaction, args);
        break;
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_PROJECT:
        await this.handleSelectProject(interaction);
        break;
      case 'paginate':
        await this.handlePagination(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowProjects(interaction: TrackedInteraction, args: { fundingRoundId: number; showUnvoted: boolean }): Promise<void> {
    const { fundingRoundId, showUnvoted } = args;
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const projects = await this.getItemsForPage(interaction, currentPage, showUnvoted);

    if (projects.length === 0) {
      throw new EndUserError('There are no eligible projects to vote on at the moment.');
    }

    const embed = new EmbedBuilder().setColor('#0099ff').setTitle('Select A Project To Consider On')
      .setDescription(`Please select a project on which you would like to submit your consideration vote in the dropdown below. 
                       Details of the selected project will be displayed once one is selected.
                       Page ${currentPage + 1} of ${totalPages}`);

    const options = await Promise.all(
      projects.map(async (p) => {
        let base = {
          label: DiscordLimiter.limitTo100(p.name),
          value: p.id.toString(),
          description: DiscordLimiter.limitTo100(`Budget: ${p.budget}`),
        };
        const lastVote: any = await ConsiderationLogic.mostRecentSMEVote(interaction.interaction.user.id, p.id);
        if (lastVote) {
          base.description += `\n| Your Current Vote: ${lastVote.isPass ? 'Approved 🟢' : 'Rejected 🔴'}`;
        }
        return base;
      }),
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SELECT_PROJECT,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.SHOW_UNVOTED,
          showUnvoted.toString(),
        ),
      )
      .setPlaceholder('Select a Project')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [row];

    if (totalPages > 1) {
      const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
      components.push(paginationRow);
    }

    await interaction.respond({ embeds: [embed], components, ephemeral: true });
  }

  private async handleSelectProject(interaction: TrackedInteraction): Promise<void> {
    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      throw new EndUserError('Invalid interaction type.');
    }

    const projectId = parseInt(interactionWithValues.values[0]);
    const fundingRoundId = parseInt(
      CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID) || '',
    );

    await (this.screen as ConsiderationHomeScreen).smeConsiderationVoteAction.handleOperation(
      interaction,
      CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_VOTE_OPTIONS,
      { projectId, fundingRoundId },
    );
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(fundingRoundId: number, showUnvoted: boolean): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_PROJECTS,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.SHOW_UNVOTED,
          showUnvoted.toString(),
        ),
      )
      .setLabel('Select Project')
      .setStyle(ButtonStyle.Primary);
  }
}

class SMEConsiderationVoteAction extends Action {
  public static readonly ID = CONSIDERATION_CONSTANTS.ACTION_IDS.SME_CONSIDERATION_VOTE;

  public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
    switch (operationId) {
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SHOW_VOTE_OPTIONS:
        await this.handleShowVoteOptions(interaction, args);
        break;
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.SUBMIT_VOTE:
        await this.handleSubmitVote(interaction);
        break;
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.CONFIRM_VOTE:
        await this.handleConfirmVote(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowVoteOptions(interaction: TrackedInteraction, args: { projectId: number; fundingRoundId: number }): Promise<void> {
    const { projectId, fundingRoundId } = args;
    const project = await Proposal.findByPk(projectId);
    const fundingRound = await FundingRound.findByPk(fundingRoundId);
    const existingVote = await ConsiderationLogic.mostRecentSMEVote(interaction.interaction.user.id, projectId);

    if (!project || !fundingRound) {
      throw new EndUserError('Project or Funding Round not found.');
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`You're ${existingVote ? 'Changing Your Vote' : 'Voting'} on ${DiscordLimiter.limitTo50(project.name)} in ${fundingRound.name}`)
      .setDescription(
        `Here, you can ${existingVote ? `change your vote (${existingVote.isPass ? 'Approved' : 'Rejected'})` : 'vote'} on ${DiscordLimiter.limitTo50(
          project.name,
        )}.`,
      )
      .addFields(
        {
          name: 'Funding Round Info',
          value: DiscordLimiter.EmbedBuilder.limitFieldValue(
            `ID: ${fundingRound.id}\nBudget: ${
              fundingRound.budget
            }\nStart: ${fundingRound.startAt.toLocaleString()}\nEnd: ${fundingRound.endAt.toLocaleString()}`,
          ),
        },
        {
          name: 'Project Info',
          value: DiscordLimiter.EmbedBuilder.limitFieldValue(
            `ID: ${project.id}\nName: ${project.name}\nBudget: ${project.budget.toString()}\nSubmitter: ${project.proposerDuid}\nURI: ${project.uri}`,
          ),
        },
      );

    if (existingVote) {
      embed.addFields({ name: 'Current Vote', value: existingVote.isPass ? 'Approved' : 'Rejected' });
    }

    const approveButton = new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SUBMIT_VOTE,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.PROJECT_ID,
          projectId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE,
          CONSIDERATION_CONSTANTS.VOTE_OPTIONS.APPROVE,
        ),
      )
      .setLabel(existingVote ? 'Change to Approve' : 'Approve Project')
      .setStyle(ButtonStyle.Success);

    const rejectButton = new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.SUBMIT_VOTE,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.PROJECT_ID,
          projectId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE,
          CONSIDERATION_CONSTANTS.VOTE_OPTIONS.REJECT,
        ),
      )
      .setLabel(existingVote ? 'Change to Reject' : 'Reject Project')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (existingVote && existingVote.isPass) {
      row.addComponents(rejectButton);
    } else if (existingVote && !existingVote.isPass) {
      row.addComponents(approveButton);
    } else {
      row.addComponents(approveButton, rejectButton);
    }

    await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
  }

  private async handleSubmitVote(interaction: TrackedInteraction): Promise<void> {
    const projectId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.PROJECT_ID) || '');
    const fundingRoundId = parseInt(
      CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID) || '',
    );
    const vote = CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE);

    if (!vote) {
      throw new EndUserError('vote not provided in customId');
    }

    const isApprove = vote === CONSIDERATION_CONSTANTS.VOTE_OPTIONS.APPROVE;

    const modal = new ModalBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(
          this,
          CONSIDERATION_CONSTANTS.OPERATION_IDS.CONFIRM_VOTE,
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.PROJECT_ID,
          projectId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID,
          fundingRoundId.toString(),
          CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE,
          vote,
        ),
      )
      .setTitle(isApprove ? 'Approve Project' : 'Reject Project');

    const reasonInput = new TextInputBuilder()
      .setCustomId(CONSIDERATION_CONSTANTS.INPUT_IDS.REASON)
      .setLabel(`Reason for ${isApprove ? 'approving' : 'rejecting'} the project`)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

    const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
    if (!modalInteraction) {
      throw new EndUserError('Failed to show modal. Please try again.');
    }

    await modalInteraction.showModal(modal);
  }

  private async handleConfirmVote(interaction: TrackedInteraction): Promise<void> {
    const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
    if (!modalInteraction) {
      throw new EndUserError('Invalid interaction type.');
    }

    const projectId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.PROJECT_ID) || '');
    const fundingRoundId = parseInt(
      CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.FUNDING_ROUND_ID) || '',
    );
    const vote = CustomIDOracle.getNamedArgument(interaction.customId, CONSIDERATION_CONSTANTS.CUSTOM_ID_ARGS.VOTE);
    const reason = modalInteraction.fields.getTextInputValue(CONSIDERATION_CONSTANTS.INPUT_IDS.REASON);

    const isApprove = vote === CONSIDERATION_CONSTANTS.VOTE_OPTIONS.APPROVE;

    try {
      await ConsiderationLogic.submitVote(interaction.interaction.user.id, projectId, fundingRoundId, isApprove, reason);

      const embed = new EmbedBuilder()
        .setColor('#28a745')
        .setTitle('Vote Submitted Successfully')
        .setDescription(`Your vote to ${isApprove ? 'approve' : 'reject'} the project has been recorded.`)
        .addFields(
          { name: 'Project ID', value: projectId.toString() },
          { name: 'Funding Round ID', value: fundingRoundId.toString() },
          { name: 'Decision', value: isApprove ? 'Approved' : 'Rejected' },
          { name: 'Reason', value: reason },
        );

      await interaction.respond({ embeds: [embed], ephemeral: true });
    } catch (error) {
      throw new EndUserError(`Error submitting vote`, error);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    throw new EndUserError('SMEConsiderationVoteAction does not have a standalone component.');
  }
}
