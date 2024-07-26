import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, TextInputStyle, TextInputBuilder, ModalBuilder, UserSelectMenuBuilder, User } from 'discord.js';
import { FundingRoundLogic } from './FundingRoundLogic';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { FundingRound, FundingRoundDeliberationCommitteeSelection, SMEGroup, TopicCommittee } from '../../../models';
import { InteractionProperties } from '../../../core/Interaction';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { FundingRoundPhase } from '../../../types';

export class ManageFundingRoundsScreen extends Screen {
    public static readonly ID = 'manageFundingRounds';
  
    protected permissions: Permission[] = []; // TODO: Implement proper admin permissions
  
    public readonly createFundingRoundAction: CreateFundingRoundAction;
    public readonly modifyFundingRoundAction: ModifyFundingRoundAction;
    public readonly setFundingRoundCommitteeAction: SetFundingRoundCommitteeAction;
    public readonly removeFundingRoundCommitteeAction: RemoveFundingRoundCommitteeAction;
    public readonly approveFundingRoundAction: ApproveFundingRoundAction;
  
    constructor(dashboard: Dashboard, screenId: string) {
      super(dashboard, screenId);
      this.createFundingRoundAction = new CreateFundingRoundAction(this, CreateFundingRoundAction.ID);
      this.modifyFundingRoundAction = new ModifyFundingRoundAction(this, ModifyFundingRoundAction.ID);
      this.setFundingRoundCommitteeAction = new SetFundingRoundCommitteeAction(this, SetFundingRoundCommitteeAction.ID);
      this.removeFundingRoundCommitteeAction = new RemoveFundingRoundCommitteeAction(this, RemoveFundingRoundCommitteeAction.ID);
      this.approveFundingRoundAction = new ApproveFundingRoundAction(this, ApproveFundingRoundAction.ID);
    }
  
    protected allSubScreens(): Screen[] {
      return [];
    }
  
    protected allActions(): Action[] {
      return [
        this.createFundingRoundAction,
        this.modifyFundingRoundAction,
        this.setFundingRoundCommitteeAction,
        this.removeFundingRoundCommitteeAction,
        this.approveFundingRoundAction,
      ];
    }
  
    protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Manage Funding Rounds')
        .setDescription('Select an action to manage funding rounds:');
  
      const createButton = this.createFundingRoundAction.getComponent();
      const modifyButton = this.modifyFundingRoundAction.getComponent();
      const addCommitteeButton = this.setFundingRoundCommitteeAction.getComponent();
      const removeCommitteeButton = this.removeFundingRoundCommitteeAction.getComponent();
      const approveButton = this.approveFundingRoundAction.getComponent();
  
      const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(createButton, modifyButton);
      
      const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(addCommitteeButton, removeCommitteeButton);
      
      const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(approveButton);
  
      const components = [row1, row2, row3];
  
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

export class CreateFundingRoundAction extends Action {
    public static readonly ID = 'createFundingRound';

    private static readonly OPERATIONS = {
        SHOW_BASIC_INFO_FORM: 'showBasicInfoForm',
        SUBMIT_BASIC_INFO: 'submitBasicInfo',
        SHOW_PHASE_FORM: 'showPhaseForm',
        SUBMIT_PHASE: 'submitPhase',
    };

    private static readonly INPUT_IDS = {
        NAME: 'name',
        DESCRIPTION: 'description',
        TOPIC_NAME: 'topicName',
        BUDGET: 'budget',
        VOTING_ADDRESS: 'votingAddress',
        START_DATE: 'startDate',
        END_DATE: 'endDate',
    };

    private static readonly PHASE_NAMES = {
        CONSIDERATION: 'Consideration',
        DELIBERATION: 'Deliberation',
        VOTING: 'Voting',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case CreateFundingRoundAction.OPERATIONS.SHOW_BASIC_INFO_FORM:
                await this.handleShowBasicInfoForm(interaction);
                break;
            case CreateFundingRoundAction.OPERATIONS.SUBMIT_BASIC_INFO:
                await this.handleSubmitBasicInfo(interaction);
                break;
            case CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM:
                await this.handleShowPhaseForm(interaction);
                break;
            case CreateFundingRoundAction.OPERATIONS.SUBMIT_PHASE:
                await this.handleSubmitPhase(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowBasicInfoForm(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SUBMIT_BASIC_INFO))
            .setTitle('Create New Funding Round');

        const nameInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.NAME)
            .setLabel('Funding Round Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.DESCRIPTION)
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const topicNameInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.TOPIC_NAME)
            .setLabel('Topic Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const budgetInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.BUDGET)
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const votingAddressInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.VOTING_ADDRESS)
            .setLabel('Voting Address')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(topicNameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(votingAddressInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitBasicInfo(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type', ephemeral: true });
            throw new Error('Invalid interaction type ' + interaction.interaction);
        }

        const name = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.DESCRIPTION);
        const topicName = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.TOPIC_NAME);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.BUDGET));
        const votingAddress = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.VOTING_ADDRESS);

        if (isNaN(budget)) {
            await interaction.respond({ content: 'Invalid budget value. Please enter a valid number.', ephemeral: true });
            return;
        }

        try {
            const fundingRound = await FundingRoundLogic.createFundingRound(name, description, topicName, budget, votingAddress);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Funding Round Created')
                .setDescription('Please set the dates for each phase:')
                .addFields(
                    { name: 'Name', value: fundingRound.name },
                    { name: 'Description', value: fundingRound.description },
                    { name: 'Topic', value: topicName },
                    { name: 'Budget', value: fundingRound.budget.toString() },
                    { name: 'Voting Address', value: fundingRound.votingAddress }
                );

            const considerationButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, 'fundingRoundId', fundingRound.id.toString(), 'phase', CreateFundingRoundAction.PHASE_NAMES.CONSIDERATION))
                .setLabel('Set Consideration Phase')
                .setStyle(ButtonStyle.Primary);

            const deliberationButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, 'fundingRoundId', fundingRound.id.toString(), 'phase', CreateFundingRoundAction.PHASE_NAMES.DELIBERATION))
                .setLabel('Set Deliberation Phase')
                .setStyle(ButtonStyle.Primary);

            const votingButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, 'fundingRoundId', fundingRound.id.toString(), 'phase', CreateFundingRoundAction.PHASE_NAMES.VOTING))
                .setLabel('Set Voting Phase')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(considerationButton, deliberationButton, votingButton);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            await interaction.respond({ content: `Error creating funding round: ${(error as Error).message}`, ephemeral: true });
            throw error;
        }
    }

    private async handleShowPhaseForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, 'phase');

        if (!fundingRoundId || !phase) {
            await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
            return;
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
            return;
        }

        const existingPhase = await FundingRoundLogic.getFundingRoundPhase(parseInt(fundingRoundId), phase);

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_PHASE, 'fundingRoundId', fundingRoundId, 'phase', phase))
            .setTitle(`Modify ${phase} Phase Dates`);

        const startDateInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.START_DATE)
            .setLabel('Start Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(existingPhase ? existingPhase.startAt.toISOString().slice(0, 16).replace('T', ' ') : '')
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.END_DATE)
            .setLabel('End Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(existingPhase ? existingPhase.endAt.toISOString().slice(0, 16).replace('T', ' ') : '')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitPhase(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, 'phase');

        if (!fundingRoundId || !phase) {
            await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
            return;
        }

        const startDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.START_DATE));
        const endDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.END_DATE));

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            await interaction.respond({ content: 'Invalid date format. Please use YYYY-MM-DD HH:MM.', ephemeral: true });
            return;
        }

        if (startDate >= endDate) {
            await interaction.respond({ content: 'Start date must be before end date.', ephemeral: true });
            return;
        }

        try {
            const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
            if (!fundingRound) {
                await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
                return;
            }

            const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));

            // Check phase order
            if (phase === ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION) {
                const considerationPhase = existingPhases.find(p => p.phase === ModifyFundingRoundAction.PHASE_NAMES.CONSIDERATION);
                if (considerationPhase && startDate < considerationPhase.endDate) {
                    await interaction.respond({ content: 'Deliberation phase must start after Consideration phase ends.', ephemeral: true });
                    return;
                }
            } else if (phase === ModifyFundingRoundAction.PHASE_NAMES.VOTING) {
                const deliberationPhase = existingPhases.find(p => p.phase === ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION);
                if (deliberationPhase && startDate < deliberationPhase.endDate) {
                    await interaction.respond({ content: 'Voting phase must start after Deliberation phase ends.', ephemeral: true });
                    return;
                }
            }
            
            const lowerPase: string = phase.toLowerCase();
            if ((lowerPase !== 'consideration') && (lowerPase !== 'deliberation') && (lowerPase !== 'voting')) {
                await interaction.respond({ content: 'Invalid phase.', ephemeral: true });
                return;
            }
            await FundingRoundLogic.setFundingRoundPhase(parseInt(fundingRoundId), lowerPase, startDate, endDate);

            const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
            const allPhasesSet = [
                ModifyFundingRoundAction.PHASE_NAMES.CONSIDERATION,
                ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION,
                ModifyFundingRoundAction.PHASE_NAMES.VOTING
            ].every(phaseName => updatedPhases.some(p => p.phase === phaseName));

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Phase Updated')
                .setDescription(`The ${lowerPase} phase has been updated successfully.`)
                .addFields(
                    { name: 'Name', value: fundingRound.name },
                    { name: 'Description', value: fundingRound.description },
                    ...updatedPhases.map(p => ({ name: `${p.phase} Phase`, value: `Start: ${p.startDate.toISOString()}\nEnd: ${p.endDate.toISOString()}`, inline: true }))
                );

            if (allPhasesSet) {
                embed.addFields({ name: 'Status', value: 'All phases have been set for the funding round.' });
            } else {
                const remainingPhases = [
                    ModifyFundingRoundAction.PHASE_NAMES.CONSIDERATION,
                    ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION,
                    ModifyFundingRoundAction.PHASE_NAMES.VOTING
                ].filter(phaseName => !updatedPhases.some(p => p.phase === phaseName));

                embed.addFields({ name: 'Remaining Phases', value: remainingPhases.join(', ') });
            }

            const backButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).modifyFundingRoundAction, ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND, 'fundingRoundId', fundingRoundId))
                .setLabel('Back to Funding Round')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error updating phase: ${errorMessage}`, ephemeral: true });
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_BASIC_INFO_FORM))
            .setLabel('Create Funding Round')
            .setStyle(ButtonStyle.Success);
    }
}

class FundingRoundPaginationAction extends PaginationComponent {
    public static readonly ID = 'fundingRoundPagination';

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const fundingRounds = await FundingRoundLogic.getPresentAndFutureFundingRounds();
        return Math.ceil(fundingRounds.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
        const fundingRounds = await FundingRoundLogic.getPresentAndFutureFundingRounds();
        return fundingRounds.slice(page * 25, (page + 1) * 25);
    }

    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const fundingRounds = await this.getItemsForPage(interaction, currentPage);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).modifyFundingRoundAction, ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map((fr: FundingRound) => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Budget: ${fr.budget}, Status: ${fr.status}`
            })));

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(...args: any[]): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'paginate'))
            .setPlaceholder('Select a Funding Round');
    }
}

export class ModifyFundingRoundAction extends Action {
    public static readonly ID = 'modifyFundingRound';

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        SELECT_FUNDING_ROUND: 'selectFundingRound',
        SHOW_BASIC_INFO_FORM: 'showBasicInfoForm',
        SUBMIT_BASIC_INFO: 'submitBasicInfo',
        SHOW_PHASE_FORM: 'showPhaseForm',
        SUBMIT_PHASE: 'submitPhase',
    };

    public static readonly INPUT_IDS = {
        NAME: 'name',
        DESCRIPTION: 'description',
        TOPIC_NAME: 'topicName',
        BUDGET: 'budget',
        VOTING_ADDRESS: 'votingAddress',
        START_DATE: 'startDate',
        END_DATE: 'endDate',
    };

    public static readonly PHASE_NAMES = {
        CONSIDERATION: 'Consideration',
        DELIBERATION: 'Deliberation',
        VOTING: 'Voting',
    };

    private fundingRoundPaginationAction: FundingRoundPaginationAction;

    constructor(screen: Screen, actionId: string) {
        super(screen, actionId);
        this.fundingRoundPaginationAction = new FundingRoundPaginationAction(screen, FundingRoundPaginationAction.ID);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case ModifyFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
                break;
            case ModifyFundingRoundAction.OPERATIONS.SHOW_BASIC_INFO_FORM:
                await this.handleShowBasicInfoForm(interaction);
                break;
            case ModifyFundingRoundAction.OPERATIONS.SUBMIT_BASIC_INFO:
                await this.handleSubmitBasicInfo(interaction);
                break;
            case ModifyFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM:
                await this.handleShowPhaseForm(interaction);
                break;
            case ModifyFundingRoundAction.OPERATIONS.SUBMIT_PHASE:
                await this.handleSubmitPhase(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        await this.fundingRoundPaginationAction.handlePagination(interaction);
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);


        let fundingRoundId: number;
        if (!interactionWithValues) {
            const fundingRoundIdArg = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundIdArg) {
                await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
                throw new Error('Invalid interaction type, and no context passed in customId');
            }
            fundingRoundId = parseInt(fundingRoundIdArg);

        } else {
            fundingRoundId = parseInt(interactionWithValues.values[0]);
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }


        const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);
        const allPhasesSet = ['consideration', 'deliberation', 'voting']
            .every(phaseName => updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));
    

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Modify Funding Round: ${fundingRound.name} (${fundingRound.id})`)
            .setDescription('Select an action to modify the funding round:')
            .addFields(
                { name: 'Description', value: fundingRound.description },
                { name: 'Budget', value: fundingRound.budget.toString() },
                { name: 'Status', value: fundingRound.status },
                {name: 'Voting Address', value: fundingRound.votingAddress},
              ...updatedPhases.map((p: FundingRoundPhase) => ({ name: `${p.phase.charAt(0).toUpperCase() + p.phase.slice(1)} Phase`, value: `Start: ${this.formatDate(p.startDate)}\nEnd: ${this.formatDate(p.endDate)}`, inline: true }))
            );

            if (allPhasesSet) {
                embed.addFields({ name: 'Status', value: 'All phases have been set for the funding round.' });
              } else {
                const remainingPhases = ['consideration', 'deliberation', 'voting']
                  .filter(phaseName => !updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));
        
                embed.addFields({ name: 'Remaining Phases', value: remainingPhases.join(', ') });
              }

        const basicInfoButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_BASIC_INFO_FORM, 'fundingRoundId', fundingRoundId.toString()))
            .setLabel('Modify Basic Info')
            .setStyle(ButtonStyle.Primary);

        const phaseButtons = Object.values(ModifyFundingRoundAction.PHASE_NAMES).map(phase =>
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, 'fundingRoundId', fundingRoundId.toString(), 'phase', phase))
                .setLabel(`Modify ${phase} Phase`)
                .setStyle(ButtonStyle.Secondary)
        );

        const rows = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(basicInfoButton),
            new ActionRowBuilder<ButtonBuilder>().addComponents(phaseButtons)
        ];

        await interaction.update({ embeds: [embed], components: rows });
    }

    private async handleShowBasicInfoForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_BASIC_INFO, 'fundingRoundId', fundingRoundId))
            .setTitle('Modify Funding Round');

        const nameInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.NAME)
            .setLabel('Funding Round Name')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.name)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.DESCRIPTION)
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(fundingRound.description)
            .setRequired(true);

        const budgetInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.BUDGET)
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.budget.toString())
            .setRequired(true);

        const votingAddressInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.VOTING_ADDRESS)
            .setLabel('Voting Address')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.votingAddress)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(votingAddressInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitBasicInfo(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            throw new Error('Invalid interaction type ' + interaction.interaction);

        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const name = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.DESCRIPTION);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.BUDGET));
        const votingAddress = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.VOTING_ADDRESS);


        if (isNaN(budget)) {
            await interaction.respond({ content: 'Invalid budget value. Please enter a valid number.', ephemeral: true });
            return;
        }

        try {
            const updatedFundingRound = await FundingRoundLogic.updateFundingRound(parseInt(fundingRoundId), {
                name,
                description,
                budget,
                votingAddress
            });

            if (!updatedFundingRound) {
                await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
                return;
            };

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Updated')
                .setDescription('The funding round has been successfully updated.')
                .addFields(
                    { name: 'Name', value: updatedFundingRound.name },
                    { name: 'Description', value: updatedFundingRound.description },
                    { name: 'Budget', value: updatedFundingRound.budget.toString() },
                    { name: 'Voting Address', value: updatedFundingRound.votingAddress }
                );

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error updating funding round: ${errorMessage}`, ephemeral: true });
        }
    }

    private async handleShowPhaseForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, 'phase') as 'consideration' | 'deliberation' | 'voting';
    
        if (!fundingRoundId || !phase) {
          await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
          return;
        }
    
        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
          await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
          return;
        }
    
        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
          await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
          return;
        }
    
        const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
        const existingPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === phase);
    
        const modal = new ModalBuilder()
          .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_PHASE, 'fundingRoundId', fundingRoundId, 'phase', phase))
          .setTitle(`Modify ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`);
    
        const startDateInput = new TextInputBuilder()
          .setCustomId(ModifyFundingRoundAction.INPUT_IDS.START_DATE)
          .setLabel('Start Date (YYYY-MM-DD HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setValue(existingPhase ? this.formatDate(existingPhase.startDate) : '')
          .setRequired(true);
    
        const endDateInput = new TextInputBuilder()
          .setCustomId(ModifyFundingRoundAction.INPUT_IDS.END_DATE)
          .setLabel('End Date (YYYY-MM-DD HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setValue(existingPhase ? this.formatDate(existingPhase.endDate) : '')
          .setRequired(true);
    
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput)
        );
    
        await modalInteraction.showModal(modal);
      }
    
      private async handleSubmitPhase(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
          await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true }); 
        throw new Error('Invalid interaction type ' + interaction.interaction);
        }
    
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, 'phase') as 'consideration' | 'deliberation' | 'voting';
    
        if (!fundingRoundId || !phase) {
          await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
          return;
        }
    
        const startDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.START_DATE));
        const endDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.END_DATE));
    
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          await interaction.respond({ content: 'Invalid date format. Please use YYYY-MM-DD HH:MM.', ephemeral: true });
          return;
        }
    
        if (startDate >= endDate) {
          await interaction.respond({ content: 'Start date must be before end date.', ephemeral: true });
          return;
        }
    
        try {
          const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
          if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
          }
    
          const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
    
          // Check phase order
          if (phase === 'deliberation') {
            const considerationPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === 'consideration');
            if (considerationPhase && startDate < considerationPhase.endDate) {
              await interaction.respond({ content: 'Deliberation phase must start after Consideration phase ends.', ephemeral: true });
              return;
            }
          } else if (phase === 'voting') {
            const deliberationPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === 'deliberation');
            if (deliberationPhase && startDate < deliberationPhase.endDate) {
              await interaction.respond({ content: 'Voting phase must start after Deliberation phase ends.', ephemeral: true });
              return;
            }
          }
    
          await FundingRoundLogic.setFundingRoundPhase(parseInt(fundingRoundId), phase, startDate, endDate);
    
          const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
          const allPhasesSet = ['consideration', 'deliberation', 'voting']
            .every(phaseName => updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));
    
          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Funding Round Phase Updated')
            .setDescription(`The ${phase} phase has been updated successfully.`)
            .addFields(
              { name: 'Name', value: fundingRound.name },
              { name: 'Description', value: fundingRound.description },
              ...updatedPhases.map((p: FundingRoundPhase) => ({ name: `${p.phase.charAt(0).toUpperCase() + p.phase.slice(1)} Phase`, value: `Start: ${this.formatDate(p.startDate)}\nEnd: ${this.formatDate(p.endDate)}`, inline: true }))
            );
    
          if (allPhasesSet) {
            embed.addFields({ name: 'Status', value: 'All phases have been set for the funding round.' });
          } else {
            const remainingPhases = ['consideration', 'deliberation', 'voting']
              .filter(phaseName => !updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));
    
            embed.addFields({ name: 'Remaining Phases', value: remainingPhases.join(', ') });
          }
    
          const backButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND, 'fundingRoundId', fundingRoundId))
            .setLabel('Back to Funding Round')
            .setStyle(ButtonStyle.Secondary);
    
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    
          await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          await interaction.respond({ content: `Error updating phase: ${errorMessage}`, ephemeral: true });
        }
      }
    
      private formatDate(date: Date): string {
        return date.toISOString().slice(0, 16).replace('T', ' ');
      } 

    public allSubActions(): Action[] {
        return [this.fundingRoundPaginationAction];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Modify Funding Round')
            .setStyle(ButtonStyle.Primary);
    }
}


export class SetFundingRoundCommitteeAction extends PaginationComponent {
    public static readonly ID = 'setFundingRoundCommittee';

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        SELECT_FUNDING_ROUND: 'selectFundingRound',
        SELECT_COMMITTEE_MEMBERS: 'selectCommitteeMembers',
        CONFIRM_COMMITTEE: 'confirmCommittee',
    };

    protected async getTotalPages(interaction: TrackedInteraction, fundingRoundId?:number): Promise<number> {
        let parsedFundingRoundId: number;
        if (fundingRoundId === undefined) {
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundIdFromCustomId) {
                throw new Error('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        } 

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parsedFundingRoundId);
        if (!fundingRound) {
            throw new Error('Funding round not found');
        }

        const topicCommittees = await TopicCommittee.findAll({
            where: { topicId: fundingRound.topicId }
        });

        let totalMembers = 0;
        for (const committee of topicCommittees) {
            const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
            if (smeGroup) {
                const groupMemberCount = await FundingRoundLogic.getSMEGroupMemberCount(smeGroup.id);
                totalMembers += groupMemberCount;
            }
        }

        return Math.ceil(totalMembers / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number, fundingRoundId?: number): Promise<string[]> {
        let parsedFundingRoundId: number;
        if (fundingRoundId === undefined) {
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundIdFromCustomId) {
                throw new Error('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parsedFundingRoundId);
        if (!fundingRound) {
            throw new Error('Funding round not found: ' + parsedFundingRoundId);
        }

        const topicCommittees = await TopicCommittee.findAll({
            where: { topicId: fundingRound.topicId }
        });

        let allMembers: string[] = [];
        for (const committee of topicCommittees) {
            const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
            if (smeGroup) {
                const groupMembers = await FundingRoundLogic.getSMEGroupMembers(smeGroup.id);
                allMembers = allMembers.concat(groupMembers);
            }
        }

        return allMembers.slice(page * 25, (page + 1) * 25);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SetFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case SetFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
                break;
            case SetFundingRoundCommitteeAction.OPERATIONS.SELECT_COMMITTEE_MEMBERS:
                await this.handleSelectCommitteeMembers(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        const fundingRounds = await FundingRoundLogic.getPresentAndFutureFundingRounds();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map(fr => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Status: ${fr.status}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.update({ components: [row] });
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        let fundingRoundId: string | undefined;
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundId) {
                await interaction.respond({ content: 'No values and no fundingRound in customId', ephemeral: true });
                throw new Error(`No values and no fundingRound in customId`);
            }
        } else {
            fundingRoundId = interactionWithValues.values[0];
        }

        const parsedFundingRoundId = parseInt(fundingRoundId);
        await this.showCommitteeMemberSelection(interaction, parsedFundingRoundId);
    }

    private async showCommitteeMemberSelection(interaction: TrackedInteraction, fundingRoundId: number): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction, fundingRoundId);
        const members = await this.getItemsForPage(interaction, currentPage, fundingRoundId);

        if (members.length === 0) {
            // TODO: later only allow eligible members to be selected
            //await interaction.respond({ content: 'This funding round does not have a required committee set on the Topic.', ephemeral: true });
        }
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SELECT_COMMITTEE_MEMBERS, 'fundingRoundId', fundingRoundId.toString()))
            .setPlaceholder('Select committee members')
            .setMaxValues(25);

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }


    private async handleSelectCommitteeMembers(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true }); 
            throw new Error('Invalid interaction type ' + interaction.interaction);
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const selectedMembers = interactionWithValues.values;
        
        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }


        const numCreatedRecords: number = await FundingRoundLogic.appendFundingRoundCommitteeMembers(parseInt(fundingRoundId), selectedMembers);

        const topicCommittees = await TopicCommittee.findAll({
            where: { topicId: fundingRound.topicId }
        });

        let isValid = true;
        const committeeCounts: { [key: number]: number } = {};

        for (const committee of topicCommittees) {
            const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
            if (smeGroup) {
                const numMembersFromGroupInCommittee = await FundingRoundLogic.countSMEMembersInDeliberationCommittee(parseInt(fundingRoundId), smeGroup.id);
                committeeCounts[committee.id] = numMembersFromGroupInCommittee;
                if (numMembersFromGroupInCommittee < committee.numUsers) {
                    isValid = false;
                }
            }
        }


        if (!isValid) {
            const addMoreCommitteeMembersButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND, 'fundingRoundId', fundingRoundId))
                .setLabel('Add More Committee Members')
                .setStyle(ButtonStyle.Primary);

            const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(addMoreCommitteeMembersButton);

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`Incomplete Committe Selection For ${fundingRound.name}`)
                .setDescription(`New Members Added: ${numCreatedRecords}. The selected members do not meet the requirements for each SME group. Please add them.`);

            for (const committee of topicCommittees) {
                const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
                if (smeGroup) {
                    embed.addFields({
                        name: smeGroup.name,
                        value: `Required: ${committee.numUsers}, Selected: ${committeeCounts[committee.id] || 0}`,
                        inline: true
                    });
                }
            }

            await interaction.update({ embeds: [embed], components: [buttonsRow] });
            return;
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Back To Funding Rounds')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Full Committee Selected For ${fundingRound.name}`)
            .setDescription(`New members assigned: ${numCreatedRecords}. Assinged Funding Round deliberation phase committee members meet the requirements for each SME group.`);

            for (const committee of topicCommittees) {
                const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
                if (smeGroup) {
                    embed.addFields({
                        name: smeGroup.name,
                        value: `Required: ${committee.numUsers}, Selected: ${committeeCounts[committee.id] || 0}`,
                        inline: true
                    });
                }
            }

        await interaction.update({ embeds: [embed], components: [row] });
    }
  

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Add To Funding Round Committee')
            .setStyle(ButtonStyle.Primary);
    }
}

export class ApproveFundingRoundAction extends Action {
    public static readonly ID = 'approveFundingRound';

    private static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        CONFIRM_APPROVAL: 'confirmApproval',
        EXECUTE_APPROVAL: 'executeApproval',
        EXECUTE_REJECTION: 'executeRejection',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case ApproveFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case ApproveFundingRoundAction.OPERATIONS.CONFIRM_APPROVAL:
                await this.handleConfirmApproval(interaction);
                break;
            case ApproveFundingRoundAction.OPERATIONS.EXECUTE_APPROVAL:
                await this.handleExecuteApproval(interaction);
                break;
            case ApproveFundingRoundAction.OPERATIONS.EXECUTE_REJECTION:
                await this.handleExecuteRejection(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        const fundingRounds = await FundingRoundLogic.getPresentAndFutureFundingRounds();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.CONFIRM_APPROVAL))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map(fr => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Status: ${fr.status}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.update({ components: [row] });
    }

    private async handleConfirmApproval(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true }); 
            throw new Error('Invalid interaction type ' + interaction.interaction);
        }

        const fundingRoundId = parseInt(interactionWithValues.values[0]);
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Approve/Reject Funding Round: ${fundingRound.name}`)
            .setDescription('Please confirm that the on-chain voting has been completed and votes have been counted.')
            .addFields(
                { name: 'Description', value: fundingRound.description },
                { name: 'Budget', value: fundingRound.budget.toString() },
                { name: 'Current Status', value: fundingRound.status }
            );

        const approveButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.EXECUTE_APPROVAL, 'fundingRoundId', fundingRoundId.toString()))
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.EXECUTE_REJECTION, 'fundingRoundId', fundingRoundId.toString()))
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(approveButton, rejectButton);

        await interaction.update({ embeds: [embed], components: [row] });
    }

    private async handleExecuteApproval(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        try {
            const approvedFundingRound = await FundingRoundLogic.approveFundingRound(parseInt(fundingRoundId));
            if (!approvedFundingRound) {
                await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Approved')
                .setDescription(`The funding round "${approvedFundingRound.name}" has been successfully approved.`)
                .addFields(
                    { name: 'Description', value: approvedFundingRound.description },
                    { name: 'Budget', value: approvedFundingRound.budget.toString() },
                    { name: 'Status', value: approvedFundingRound.status }
                );

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error approving funding round: ${errorMessage}`, ephemeral: true });
        }
    }

    private async handleExecuteRejection(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        try {
            const rejectedFundingRound = await FundingRoundLogic.rejectFundingRound(parseInt(fundingRoundId));
            if (!rejectedFundingRound) {
                await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Funding Round Rejected')
                .setDescription(`The funding round "${rejectedFundingRound.name}" has been rejected.`)
                .addFields(
                    { name: 'Description', value: rejectedFundingRound.description },
                    { name: 'Budget', value: rejectedFundingRound.budget.toString() },
                    { name: 'Status', value: rejectedFundingRound.status }
                );

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error rejecting funding round: ${errorMessage}`, ephemeral: true });
        }

    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Approve/Reject Funding Round')
            .setStyle(ButtonStyle.Primary);
    }
}

export class RemoveFundingRoundCommitteeAction extends PaginationComponent {
    public static readonly ID = 'removeFundingRoundCommittee';

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        SELECT_FUNDING_ROUND: 'selectFundingRound',
        SELECT_MEMBERS_TO_REMOVE: 'selectMembersToRemove',
        CONFIRM_REMOVAL: 'confirmRemoval',
        REMOVE_ALL_MEMBERS: 'removeAllMembers',
    };

    protected async getTotalPages(interaction: TrackedInteraction, fundingRoundId?: number): Promise<number> {
        let parsedFundingRoundId: number;
        if (fundingRoundId === undefined) {
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundIdFromCustomId) {
                throw new Error('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        }

        const committeeMembers = await FundingRoundLogic.getFundingRoundCommitteeMembers(parsedFundingRoundId);
        return Math.ceil(committeeMembers.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number, fundingRoundId?: number): Promise<string[]> {
        let parsedFundingRoundId: number;
        if (fundingRoundId === undefined) {
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
            if (!fundingRoundIdFromCustomId) {
                throw new Error('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        }

        const committeeMembers = await FundingRoundLogic.getFundingRoundCommitteeMembers(parsedFundingRoundId);
        return committeeMembers.slice(page * 25, (page + 1) * 25);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case RemoveFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
                break;
            case RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_MEMBERS_TO_REMOVE:
                await this.handleSelectMembersToRemove(interaction);
                break;
            case RemoveFundingRoundCommitteeAction.OPERATIONS.REMOVE_ALL_MEMBERS:
                await this.handleRemoveAllMembers(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        const fundingRounds = await FundingRoundLogic.getPresentAndFutureFundingRounds();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map(fr => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Status: ${fr.status}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.update({ components: [row] });
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const fundingRoundId = interactionWithValues.values[0];
        await this.showMemberRemovalSelection(interaction, parseInt(fundingRoundId));
    }

    private async showMemberRemovalSelection(interaction: TrackedInteraction, fundingRoundId: number): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction, fundingRoundId);
        const members = await this.getItemsForPage(interaction, currentPage, fundingRoundId);

        if (members.length === 0) {
            await interaction.respond({ content: 'This funding round does not have any committee members.', ephemeral: true });
            return;
        }

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_MEMBERS_TO_REMOVE, 'fundingRoundId', fundingRoundId.toString()))
            .setPlaceholder('Select members to remove')
            .setMaxValues(25);

        const removeAllButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.REMOVE_ALL_MEMBERS, 'fundingRoundId', fundingRoundId.toString()))
            .setLabel('Remove All Members')
            .setStyle(ButtonStyle.Danger);

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(removeAllButton)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    private async handleSelectMembersToRemove(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const selectedMembers = interactionWithValues.values;
        
        const numRemovedRecords = await FundingRoundLogic.removeFundingRoundCommitteeMembers(parseInt(fundingRoundId), selectedMembers);

        await this.showCommitteeStatus(interaction, parseInt(fundingRoundId), numRemovedRecords);
    }

    private async handleRemoveAllMembers(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const numRemovedRecords = await FundingRoundLogic.removeAllFundingRoundCommitteeMembers(parseInt(fundingRoundId));

        await this.showCommitteeStatus(interaction, parseInt(fundingRoundId), numRemovedRecords);
    }

    private async showCommitteeStatus(interaction: TrackedInteraction, fundingRoundId: number, numRemovedRecords: number): Promise<void> {
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }

        const topicCommittees = await TopicCommittee.findAll({
            where: { topicId: fundingRound.topicId }
        });

        let isComplete = true;
        const committeeCounts: { [key: number]: number } = {};

        for (const committee of topicCommittees) {
            const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
            if (smeGroup) {
                const numMembersFromGroupInCommittee = await FundingRoundLogic.countSMEMembersInDeliberationCommittee(fundingRoundId, smeGroup.id);
                committeeCounts[committee.id] = numMembersFromGroupInCommittee;
                if (numMembersFromGroupInCommittee < committee.numUsers) {
                    isComplete = false;
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(isComplete ? '#00FF00' : '#FF0000')
            .setTitle(`Committee Status For ${fundingRound.name}`)
            .setDescription(`Members removed: ${numRemovedRecords}. ${isComplete ? 'The committee meets all requirements.' : 'The committee does not meet all requirements.'}`);

        for (const committee of topicCommittees) {
            const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
            if (smeGroup) {
                embed.addFields({
                    name: smeGroup.name,
                    value: `Required: ${committee.numUsers}, Current: ${committeeCounts[committee.id] || 0}`,
                    inline: true
                });
            }
        }

        const backButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Back To Funding Rounds')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

        await interaction.update({ embeds: [embed], components: [row] });
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Remove From Funding Round Committee')
            .setStyle(ButtonStyle.Danger);
    }
}