// src/channels/vote/screens/ProjectVotingScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ArgumentOracle, CustomIDOracle } from '../../../CustomIDOracle';
import { ProposalLogic } from '../../../logic/ProposalLogic';
import { VoteLogic } from '../../../logic/VoteLogic';
import { FundingRound, GPTSummarizerVoteLog, Proposal } from '../../../models';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { InteractionProperties } from '../../../core/Interaction';
import { FundingRoundLogic } from '../../admin/screens/FundingRoundLogic';
import { OCVLinkGenerator } from '../../../utils/OCVLinkGenerator';
import logger from '../../../logging';
import { EndUserError, EndUserInfo } from '../../../Errors';
import { proposalStatusToPhase } from '../../proposals/ProposalsForumManager';
import { DiscordLimiter } from '../../../utils/DiscordLimiter';

export class ProjectVotingScreen extends Screen {
  public static readonly ID = 'prVt';

  protected permissions: Permission[] = [];

  public readonly selectPhaseAction: SelectPhaseAction;
  public readonly selectProjectAction: SelectProjectAction;
  public readonly voteProjectAction: VoteProjectAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.selectPhaseAction = new SelectPhaseAction(this, SelectPhaseAction.ID);
    this.selectProjectAction = new SelectProjectAction(this, SelectProjectAction.ID);
    this.voteProjectAction = new VoteProjectAction(this, VoteProjectAction.ID);
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [this.selectPhaseAction, this.selectProjectAction, this.voteProjectAction];
  }

  protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const fundingRoundIdFromContext: string | undefined = interaction?.Context.get('frId');
    if (!fundingRoundIdFromContext) {
      return {
        content: 'FundingRoundID not passed in context',
        ephemeral: true,
      };
    }

    const fundingRoundId = parseInt(fundingRoundIdFromContext);

    if (!fundingRoundId) {
      return {
        content: 'Invalid funding round ID.',
        ephemeral: true,
      };
    }

    const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      return {
        content: 'Funding round not found.',
        ephemeral: true,
      };
    }

    const activePhases = await FundingRoundLogic.getActiveFundingRoundPhases(fundingRoundId);
    const shouldSelectPhase = activePhases.length > 1;

    let description: string = `In this section you can cast your votes on approval or rejections of projects in ${fundingRound.name}.`;
    if (shouldSelectPhase) {
      description += 'Since there is a more than one phase to vote on, you will need to select the phase first. ';
    } else {
      description += 'Begin by selecting a project to vote ';
    }

    const embed = new EmbedBuilder().setColor('#0099ff').setTitle(`Vote on Projects In ${fundingRound.name}`).setDescription(description);

    let components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

    if (activePhases.length > 1) {
      // TODO: This wasn't tested. Also, will this ever happen?
      // NOTE for reader: this branch handles the display of phase to vote on, if there is more than one active phase
      const selectPhaseButton = this.selectPhaseAction.getComponent(fundingRoundId);
      const displayData = this.selectProjectAction.getSelectProjectComponent(interaction, fundingRoundId, activePhases[0]);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(selectPhaseButton));
    } else if (activePhases.length === 1) {
      const selectProjectButton = this.selectProjectAction.getComponent(fundingRoundId, activePhases[0]);
      interaction.Context.set('ph', activePhases[0]);
      interaction.Context.set('frId', fundingRoundId.toString());
      const displayData = await this.selectProjectAction.getSelectProjectComponent(interaction, fundingRoundId, activePhases[0]);
      components = displayData.components;
    } else {
      embed.setDescription('There are no active voting phases for this funding round at the moment.');
    }

    return {
      embeds: [embed],
      components,
      ephemeral: true,
    };
  }
}

class SelectPhaseAction extends Action {
  public static readonly ID = 'selectPhase';

  public static readonly OPERATIONS = {
    showPhases: 'showPhases',
    selectPhase: 'selectPhase',
  };

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'frId') || '');
    const activePhases = await FundingRoundLogic.getActiveFundingRoundPhases(fundingRoundId);

    const options = activePhases.map((phase) => ({
      label: phase.charAt(0).toUpperCase() + phase.slice(1),
      value: phase,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(
        CustomIDOracle.generateCustomId(
          this.screen.dashboard,
          this.screen,
          (this.screen as ProjectVotingScreen).selectProjectAction,
          SelectProjectAction.OPERATIONS.showProjects,
        ),
      )
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'selectPhase', 'frId', fundingRoundId.toString()))
      .setPlaceholder('Select a Voting Phase')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.respond({ components: [row], ephemeral: true });
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(fundingRoundId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'selectPhase', 'frId', fundingRoundId.toString()))
      .setLabel('Select Voting Phase')
      .setStyle(ButtonStyle.Primary);
  }
}

export class SelectProjectAction extends PaginationComponent {
  public static readonly ID = 'slPr';

  public static readonly OPERATIONS = {
    showProjects: 'showProjects',
    selectProject: 'slPr',
    paginate: 'paginate',
  };

  protected async getTotalPages(interaction: TrackedInteraction, phaseArg?: string): Promise<number> {
    const fundingRoundIdRaw: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

    let fundingRoundId: number = parseInt(fundingRoundIdRaw);

    let phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);
    phase = phase.toLowerCase();

    const projects = await FundingRoundLogic.getActiveProposalsForPhase(fundingRoundId, phase);
    return Math.ceil(projects.length / 25);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<Proposal[]> {
    const fundingRoundIdRaw: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

    let fundingRoundId: number = parseInt(fundingRoundIdRaw);

    const phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);

    const projects = await FundingRoundLogic.getActiveProposalsForPhase(fundingRoundId, phase);
    return projects.slice(page * 25, (page + 1) * 25);
  }

  public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case SelectProjectAction.OPERATIONS.showProjects:
        await this.handleShowProjects(interaction);
        break;
      case SelectProjectAction.OPERATIONS.selectProject:
        await this.handleSelectProject(interaction);
        break;
      case SelectProjectAction.OPERATIONS.paginate:
        await this.handlePagination(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  public async getSelectProjectComponent(interaction: TrackedInteraction, fundingRoundId: number, phase: string) {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction, phase);
    const projects = await this.getItemsForPage(interaction, currentPage);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Select a Project to Vote On')
      .setDescription(
        `Here, you can select a project that you can vote on. A vote can either an approval or rejection. Page ${currentPage + 1} of ${totalPages}`,
      );

    const embeds = [embed];

    const options = projects.map((p) => ({
      label: p.name,
      value: p.id.toString(),
      description: `Budget: ${p.budget}`,
    }));

    const selectMenu: StringSelectMenuBuilder = new StringSelectMenuBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(this, SelectProjectAction.OPERATIONS.selectProject, 'frId', fundingRoundId.toString(), 'ph', phase),
      )
      .setPlaceholder('Select a Project to Vote On')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [row];

    if (totalPages > 1) {
      const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
      components.push(paginationRow);
    }

    return { embeds, components, ephemeral: true };
  }

  private async handleShowProjects(interaction: TrackedInteraction): Promise<void> {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const projects = await this.getItemsForPage(interaction, currentPage);

    const fundingRoundIdRaw: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'frId');
    if (!fundingRoundIdRaw) {
      throw new EndUserError('fundingRoundId not passed in customId');
    }
    const fundingRoundId: number = parseInt(fundingRoundIdRaw);

    const phase: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'ph');
    let parsedPhase: string;

    if (!phase) {
      const parsedInteraction = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
      if (!parsedInteraction) {
        throw new EndUserError('phase neither passed in customId, nor the interaction has values');
      }
      const chosenPhase: string = parsedInteraction.values[0];
      parsedPhase = chosenPhase.toLocaleLowerCase();
    } else {
      parsedPhase = phase.toLocaleLowerCase();
    }

    if (projects.length === 0) {
      throw new EndUserInfo('ℹ️ There are no active projects for voting in this phase at the moment.');
    }

    const displayData = this.getSelectProjectComponent(interaction, fundingRoundId, parsedPhase);
    await interaction.respond(displayData);
  }

  private async handleSelectProject(interaction: TrackedInteraction): Promise<void> {
    const projectId = ArgumentOracle.getNamedArgument(interaction, 'prId');

    const fundingRoundIdFromCI: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

    const fundingRoundId: number = parseInt(fundingRoundIdFromCI);
    const phase = ArgumentOracle.getNamedArgument(interaction, 'ph');

    interaction.Context.set('prId', projectId.toString());
    interaction.Context.set('frId', fundingRoundId.toString());
    interaction.Context.set('ph', phase);
    await (this.screen as ProjectVotingScreen).voteProjectAction.handleOperation(interaction, 'showVoteOptions', {
      projectId,
      fundingRoundId,
      phase,
    });
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(fundingRoundId: number, phase: string): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(this, SelectProjectAction.OPERATIONS.showProjects, 'frId', fundingRoundId.toString(), 'ph', phase),
      )
      .setLabel('Select Project')
      .setStyle(ButtonStyle.Primary);
  }
}

class VoteProjectAction extends Action {
  public static readonly ID = 'voteProject';

  public static readonly OPERATIONS = {
    showVoteOptions: 'showVoteOptions',
    submitDeliberationReasoning: 'submitDeliberationReasoning',
    submitReasoningModal: 'submitReasoningModal',
  };

  public static readonly MODAL_FIELDS = {
    reasoning: 'reasoning',
    updateReasoning: 'update_reasoning',
  };

  public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
    switch (operationId) {
      case VoteProjectAction.OPERATIONS.showVoteOptions:
        await this.handleShowVoteOptions(interaction, args);
        break;
      case VoteProjectAction.OPERATIONS.submitDeliberationReasoning:
        await this.handleSubmitDeliberationReasoning(interaction);
        break;
      case VoteProjectAction.OPERATIONS.submitReasoningModal:
        await this.handleModalSubmit(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleShowVoteOptions(
    interaction: TrackedInteraction,
    args: { projectId: number; fundingRoundId: number; phase: string },
  ): Promise<void> {
    const { projectId, fundingRoundId } = args;
    const project = await ProposalLogic.getProposalByIdOrError(projectId);
    logger.info(`Funding Round ID: ${fundingRoundId}`);

    const fundingRoundPhases = await FundingRoundLogic.getActiveFundingRoundPhases(fundingRoundId);
    const proposalPhase: string = proposalStatusToPhase(project.status);

    if (!fundingRoundPhases) {
      throw new EndUserError('All voting is currently closed in the Funding Round');
    }

    if (!fundingRoundPhases.includes(proposalPhase)) {
      throw new EndUserError(
        `Voting for this project is unavailable. Funding Round has voting open in ${fundingRoundPhases.join(
          ', ',
        )}, but proposal is in ${proposalPhase}.`,
      );
    }

    const hasUserSubmittedReasoning: boolean = await VoteLogic.hasUserSubmittedDeliberationReasoning(interaction.interaction.user.id, projectId);
    const gptResponseButtonLabel: string = hasUserSubmittedReasoning ? '✏️ Update Reasoning' : '✍️ Submit Reasoning';
    const gptResponseButtonLabelWithoutEmoji: string = hasUserSubmittedReasoning ? 'Update Reasoning' : 'Submit Reasoning';

    // assuming consideration phase
    let description: string = `
        Voting Stage: 1️⃣/3️⃣
        Current Phase: ${proposalPhase} Next Phase: deliberation

        Here, you vote on the project's approval or rejection for the deliberation phase. Votes can be changed until the end of the voting period.
        
        The most recent vote is considered as the final vote.
        
        There are two types of votes:
        - Approve - You believe the project should be funded.
        - Reject - Remove most recent 'Approve' vote, if exists.

        The voting is done on-chain. Click the button below to vote.
        `;

    if (proposalPhase === 'deliberation') {
      description = `
            Voting Stage: 2️⃣/3️⃣
            Current Phase: ${proposalPhase} Previous Phase: consideration Next Phase: funding

            The current phase is the deliberation phase. In this phase, you can submit your reasoning for why you believe the project should be funded or not.

            Your reasoning and discord user ID will be stored for internal records and may be analyzed by third-party systems. By pressing the "${gptResponseButtonLabelWithoutEmoji}" button below, you agree to these terms.
         `;
    }

    if (proposalPhase === 'funding') {
      description = `
            Voting Stage: 3️⃣/3️⃣ 
            Current Phase: ${proposalPhase} Previous Phase: deliberation

            ⚠️ This is the final voting stage. The votes in this stage decide which projects will be funded.

            The current phase is the funding phase. In this phase, you can vote on the project's approval or rejection for funding. Votes can be changed until the end of the voting period.

            The most recent vote is considered as the final vote.

            There are two types of votes:
            
            - Approve - You believe the project should be funded.
            - Reject - Remove most recent 'Approve' vote, if exists.

            The voting is done on-chain. Click the button below to vote.
            `;
    }
    // TODO: add description for each phase
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(DiscordLimiter.EmbedBuilder.limitTitle(`Vote on Project: ${project.name}`))
      .setDescription(description)
      .addFields(
        { name: 'Budget', value: DiscordLimiter.EmbedBuilder.limitField(project.budget.toString()), inline: true },
        { name: 'Status', value: project.status, inline: true },
        { name: 'URI', value: DiscordLimiter.EmbedBuilder.limitField(project.uri), inline: true },
        {
          name: 'Proposer Discord ID',
          value: project.proposerDuid,
          inline: true,
        },
      );

    let components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    switch (proposalPhase.toLowerCase()) {
      case 'consideration':
      case 'funding':
        const voteLink = OCVLinkGenerator.generateProjectVoteLink(projectId, proposalPhase);
        const voteButton = new ButtonBuilder().setLabel('🗳️ Vote On-Chain').setStyle(ButtonStyle.Link).setURL(voteLink);
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton));
        break;
      case 'deliberation':
        const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundId);
        const customId = CustomIDOracle.customIdFromRawParts(
          fundingRound.forumChannelId,
          this.screen.ID,
          VoteProjectAction.ID,
          VoteProjectAction.OPERATIONS.submitDeliberationReasoning,
          'prId',
          projectId.toString(),
          'frId',
          fundingRoundId.toString(),
        );
        const deliberationButton = new ButtonBuilder().setCustomId(customId).setLabel(gptResponseButtonLabel).setStyle(ButtonStyle.Primary);
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(deliberationButton));
        break;
    }

    await interaction.respond({ embeds: [embed], components, ephemeral: true });
  }

  private async handleSubmitDeliberationReasoning(interaction: TrackedInteraction): Promise<void> {
    const projectIdRaw = CustomIDOracle.getNamedArgument(interaction.customId, 'prId');
    const fundingRoundIdRaw = CustomIDOracle.getNamedArgument(interaction.customId, 'frId');

    if (!projectIdRaw) {
      throw new EndUserError('projectId not passed in customId');
    }

    if (!fundingRoundIdRaw) {
      throw new EndUserError('fundingRoundId not passed in customId');
    }

    const projectId: number = parseInt(projectIdRaw);
    const fundingRoundId: number = parseInt(fundingRoundIdRaw);

    const hasUserSubmittedReasoning: boolean = await VoteLogic.hasUserSubmittedDeliberationReasoning(interaction.interaction.user.id, projectId);

    const title: string = hasUserSubmittedReasoning ? '✏️ Update Reasoning' : '✍️ Submit Reasoning';

    const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundId);
    const modal = new ModalBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToActionCustomDashboardId(
          fundingRound.forumChannelId,
          this,
          VoteProjectAction.OPERATIONS.submitReasoningModal,
          'prId',
          projectId.toString(),
          'frId',
          fundingRoundId.toString(),
        ),
      )
      .setTitle(title);

    const reasoningInput = new TextInputBuilder()
      .setCustomId('reasoning')
      .setLabel('Should this project be funded? Why?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasoningInput));

    if (hasUserSubmittedReasoning) {
      const reasonInput = new TextInputBuilder()
        .setCustomId(VoteProjectAction.MODAL_FIELDS.updateReasoning)
        .setLabel('I am updating my reasoning because...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
    }

    const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
    if (!modalInteraction) {
      throw new EndUserError('Failed to show modal. Please try again.');
    }

    await modalInteraction.showModal(modal);
  }

  public async handleModalSubmit(interaction: TrackedInteraction): Promise<void> {
    const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
    if (!modalInteraction) {
      throw new EndUserError('Invalid interaction type.');
    }

    const projectIdRaw = CustomIDOracle.getNamedArgument(interaction.customId, 'prId');
    const fundingRoundIdRaw = CustomIDOracle.getNamedArgument(interaction.customId, 'frId');

    if (!projectIdRaw) {
      throw new EndUserError('projectId not passed in customId');
    }

    if (!fundingRoundIdRaw) {
      throw new EndUserError('fundingRoundId not passed in customId');
    }

    const projectId: number = parseInt(projectIdRaw);
    const fundingRoundId: number = parseInt(fundingRoundIdRaw);

    const reasoning = modalInteraction.fields.getTextInputValue(VoteProjectAction.MODAL_FIELDS.reasoning);
    let updateReasoning: string | null = null;
    try {
      updateReasoning = modalInteraction.fields.getTextInputValue(VoteProjectAction.MODAL_FIELDS.updateReasoning);
    } catch (error) {
      // reason not present in modal, it's safe to ignore
    }

    try {
      await VoteLogic.submitDeliberationReasoning(interaction.interaction.user.id, projectId, fundingRoundId, reasoning, updateReasoning);

      const embed = new EmbedBuilder()
        .setColor('#28a745')
        .setTitle('Reasoning Submitted Successfully')
        .setDescription('Your reasoning has been recorded and will be submitted to the GPTSummarizer bot for analysis.')
        .addFields({
          name: 'Warning',
          value: 'Your submitted data will be stored for internal records and may be analyzed by our or third-party systems.',
        });

      await interaction.respond({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error submitting reasoning');
      throw new EndUserError('Failed to submit reasoning', error);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(projectId: number, fundingRoundId: number, phase: string): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        CustomIDOracle.addArgumentsToAction(this, 'showVoteOptions', 'prId', projectId.toString(), 'frId', fundingRoundId.toString(), 'ph', phase),
      )
      .setLabel('Vote on Project')
      .setStyle(ButtonStyle.Primary);
  }
}
