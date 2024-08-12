import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, TextInputStyle, TextInputBuilder, ModalBuilder, UserSelectMenuBuilder, User } from 'discord.js';
import { FundingRoundLogic } from './FundingRoundLogic';
import { ArgumentOracle, CustomIDOracle } from '../../../CustomIDOracle';
import { FundingRound, FundingRoundDeliberationCommitteeSelection, SMEGroup, Topic, TopicCommittee } from '../../../models';
import { InteractionProperties } from '../../../core/Interaction';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { FundingRoundPhase } from '../../../types';
import { TopicLogic } from './ManageTopicLogicScreen';
import logger from '../../../logging';
import { EndUserError } from '../../../Errors';
import { DiscordStatus } from '../../DiscordStatus';
import { FundingRoundMI, FundingRoundMIPhaseValue } from '../../../models/Interface';


export class ManageFundingRoundsScreen extends Screen {
    public static readonly ID = 'manageFundingRounds';

    protected permissions: Permission[] = []; // TODO: Implement proper admin permissions

    public readonly createFundingRoundAction: CreateFundingRoundAction;
    public readonly modifyFundingRoundAction: ModifyFundingRoundAction;
    public readonly setFundingRoundCommitteeAction: SetFundingRoundCommitteeAction;
    public readonly removeFundingRoundCommitteeAction: RemoveFundingRoundCommitteeAction;
    public readonly approveFundingRoundAction: ApproveFundingRoundAction;
    public readonly selectFundingRoundToEditAction: SelectFundingRoundToEditAction;
    public readonly editFundingRoundTypeSelectionAction: EditFundingRoundTypeSelectionAction;
    public readonly editFundingRoundInformationAction: EditFundingRoundInformationAction;
    public readonly editFundingRoundPhasesAction: EditFundingRoundPhasesAction;
    public readonly editFundingRoundTopicAction: EditFundingRoundTopicAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.createFundingRoundAction = new CreateFundingRoundAction(this, CreateFundingRoundAction.ID);
        this.modifyFundingRoundAction = new ModifyFundingRoundAction(this, ModifyFundingRoundAction.ID);
        this.setFundingRoundCommitteeAction = new SetFundingRoundCommitteeAction(this, SetFundingRoundCommitteeAction.ID);
        this.removeFundingRoundCommitteeAction = new RemoveFundingRoundCommitteeAction(this, RemoveFundingRoundCommitteeAction.ID);
        this.approveFundingRoundAction = new ApproveFundingRoundAction(this, ApproveFundingRoundAction.ID);
        this.selectFundingRoundToEditAction = new SelectFundingRoundToEditAction(this, SelectFundingRoundToEditAction.ID);
        this.editFundingRoundTypeSelectionAction = new EditFundingRoundTypeSelectionAction(this, EditFundingRoundTypeSelectionAction.ID);
        this.editFundingRoundInformationAction = new EditFundingRoundInformationAction(this, EditFundingRoundInformationAction.ID);
        this.editFundingRoundPhasesAction = new EditFundingRoundPhasesAction(this, EditFundingRoundPhasesAction.ID);
        this.editFundingRoundTopicAction = new EditFundingRoundTopicAction(this, EditFundingRoundTopicAction.ID);
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
            this.selectFundingRoundToEditAction,
            this.editFundingRoundTypeSelectionAction,
            this.editFundingRoundInformationAction,
            this.editFundingRoundPhasesAction,
            this.editFundingRoundTopicAction,
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
        STAKING_LEDGER_EPOCH_NUM: 'stLdEpNum',
        START_DATE: 'startDate',
        END_DATE: 'endDate',
        ROUND_START_DATE: 'rSD',
        ROUND_END_DATE: 'rED',
    };

    private static readonly PHASE_NAMES = {
        CONSIDERATION: 'Consideration',
        DELIBERATION: 'Deliberation',
        VOTING: 'Voting',
        ROUND: 'Round',
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
            throw new EndUserError('This interaction does not support modals.');
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

        const stakingLedgerNumInput = new TextInputBuilder()
            .setCustomId(CreateFundingRoundAction.INPUT_IDS.STAKING_LEDGER_EPOCH_NUM)
            .setLabel('Staking Ledger Epoch Number (For Voting)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(topicNameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerNumInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitBasicInfo(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('Invalid interaction type: submit interaction required');
        }

        const name = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.DESCRIPTION);
        const topicName = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.TOPIC_NAME);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.BUDGET));
        const stakingLedgerEpochNum = modalInteraction.fields.getTextInputValue(CreateFundingRoundAction.INPUT_IDS.STAKING_LEDGER_EPOCH_NUM);

        if (isNaN(budget)) {
            throw new EndUserError('Invalid budget value. Please enter a valid number.');
        }

        if (isNaN(parseInt(stakingLedgerEpochNum))) {
            throw new EndUserError('Invalid staking ledger epoch number. Please enter a valid number.');
        }

        const ledgerNum: number = parseInt(stakingLedgerEpochNum);



        try {
            const fundingRound = await FundingRoundLogic.createFundingRound(name, description, topicName, budget, ledgerNum);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Funding Round Created')
                .setDescription('Please set the dates for each phase:')
                .addFields(
                    { name: 'Name', value: fundingRound.name },
                    { name: 'Description', value: fundingRound.description },
                    { name: 'Topic', value: topicName },
                    { name: 'Budget', value: fundingRound.budget.toString() },
                    { name: 'Staking Ledger Epoch (For Voting)', value: fundingRound.stakingLedgerEpoch.toString() }
                );

            const considerationButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRound.id.toString(), ArgumentOracle.COMMON_ARGS.PHASE, CreateFundingRoundAction.PHASE_NAMES.CONSIDERATION))
                .setLabel('Set Consideration Phase')
                .setStyle(ButtonStyle.Primary);

            const deliberationButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRound.id.toString(), ArgumentOracle.COMMON_ARGS.PHASE, CreateFundingRoundAction.PHASE_NAMES.DELIBERATION))
                .setLabel('Set Deliberation Phase')
                .setStyle(ButtonStyle.Primary);

            const votingButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRound.id.toString(), ArgumentOracle.COMMON_ARGS.PHASE, CreateFundingRoundAction.PHASE_NAMES.VOTING))
                .setLabel('Set Voting Phase')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(considerationButton, deliberationButton, votingButton);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            throw new EndUserError(`Error creating funding round: ${(error as Error).message}`);
        }
    }

    private async handleShowPhaseForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const phase = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE); 

        const modalInteraction = InteractionProperties.toShowModalOrError(interaction.interaction);

        const existingPhase = await FundingRoundLogic.getFundingRoundPhase(parseInt(fundingRoundId), phase);

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_PHASE, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, ArgumentOracle.COMMON_ARGS.PHASE, phase))
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
            throw new EndUserError('Invalid interaction type.');
        }

        const fundingRoundId: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);

        const startDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.START_DATE));
        const endDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.END_DATE));

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new EndUserError('Invalid date format. Please use YYYY-MM-DD HH:MM.');
        }

        if (startDate >= endDate) {
            throw new EndUserError('Start date must be before end date.');
        }

        try {
            const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
            if (!fundingRound) {
                throw new EndUserError('Funding round not found.');
            }

            const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));

            // Check phase order
            if (phase === ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION) {
                const considerationPhase = existingPhases.find(p => p.phase === ModifyFundingRoundAction.PHASE_NAMES.CONSIDERATION);
                if (considerationPhase && startDate < considerationPhase.endDate) {
                    throw new EndUserError('Deliberation phase must start after Consideration phase ends.');
                }
            } else if (phase === ModifyFundingRoundAction.PHASE_NAMES.VOTING) {
                const deliberationPhase = existingPhases.find(p => p.phase === ModifyFundingRoundAction.PHASE_NAMES.DELIBERATION);
                if (deliberationPhase && startDate < deliberationPhase.endDate) {
                    throw new EndUserError('Voting phase must start after Deliberation phase ends.');
                }
            }

            const lowerPase: string = phase.toLowerCase();
            if ((lowerPase !== 'consideration') && (lowerPase !== 'deliberation') && (lowerPase !== 'voting')) {
                throw new EndUserError('Invalid phase.');
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
                    { name: 'Budget', value: fundingRound.budget.toString() },
                    { name: 'Staking Ledger Epoch Number (For Voting)', value: fundingRound.stakingLedgerEpoch.toString() },
                    { name: 'Start Date', value: fundingRound.startAt ? fundingRound.startAt.toISOString() : '❌ Not set' },
                    { name: 'End Date', value: fundingRound.endAt ? fundingRound.endAt.toISOString() : '❌ Not set' },
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
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).modifyFundingRoundAction, ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
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
        EDIT_FUNDING_ROUND: 'editFundingRound',
    };

    public static readonly INPUT_IDS = {
        NAME: 'name',
        DESCRIPTION: 'description',
        TOPIC_NAME: 'topicName',
        BUDGET: 'budget',
        STAKING_LEDGER_EPOCH: 'stLdEpNum',
        START_DATE: 'startDate',
        END_DATE: 'endDate',
        ROUND_START_DATE: 'rSD',
        ROUND_END_DATE: 'rED',
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
            case ModifyFundingRoundAction.OPERATIONS.EDIT_FUNDING_ROUND:
                await this.handleEditFundingRound(interaction);
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
            const fundingRoundIdArg: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0);
            
            fundingRoundId = parseInt(fundingRoundIdArg);

        } else {
            fundingRoundId = parseInt(interactionWithValues.values[0]);
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }


        const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);
        let allPhasesSet: boolean = ['consideration', 'deliberation', 'voting']
            .every(phaseName => updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));

        allPhasesSet = allPhasesSet && (fundingRound.startAt !== null) && (fundingRound.endAt !== null);

        const topic: Topic = await fundingRound.getTopic();

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Modify Funding Round: ${fundingRound.name} (${fundingRound.id})`)
            .setDescription('Select an action to modify the funding round:')
            .addFields(
                { name: 'Description', value: fundingRound.description },
                { name: 'Topic', value: topic.name },
                { name: 'Budget', value: fundingRound.budget.toString() },
                { name: 'Status', value: fundingRound.status },
                { name: 'Staking Ledger Epoch Number (For Voting)', value: fundingRound.stakingLedgerEpoch.toString() },
                { name: 'Start Date', value: fundingRound.startAt ? fundingRound.startAt.toISOString() : '❌ Not set' },
                { name: 'End Date', value: fundingRound.endAt ? fundingRound.endAt.toISOString() : '❌ Not set' },
                ...updatedPhases.map((p: FundingRoundPhase) => ({ name: `${p.phase.charAt(0).toUpperCase() + p.phase.slice(1)} Phase`, value: `Start: ${this.formatDate(p.startDate)}\nEnd: ${this.formatDate(p.endDate)}`, inline: true }))
            );

        if (allPhasesSet) {
            embed.addFields({ name: 'Status', value: 'All phases have been set for the funding round.' });
        } else {
            let remainingPhases = ['consideration', 'deliberation', 'voting']
                .filter(phaseName => !updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));

            if (fundingRound.startAt === null || fundingRound.endAt === null) {
                remainingPhases = ['Funding Round Duration', ...remainingPhases];
            }

            embed.addFields({ name: 'Remaining Phases', value: remainingPhases.join(', ') });
        }

        const basicInfoButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_BASIC_INFO_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Modify Basic Info')
            .setStyle(ButtonStyle.Primary);

        let phaseButtons = Object.values(ModifyFundingRoundAction.PHASE_NAMES).map(phase =>
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString(), ArgumentOracle.COMMON_ARGS.PHASE, phase))
                .setLabel(`Modify ${phase} Phase`)
                .setStyle(ButtonStyle.Secondary)
        );

        const roundDurationButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_PHASE_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString(), ArgumentOracle.COMMON_ARGS.PHASE, 'round'))
            .setLabel('Modify Round Duration')
            .setStyle(ButtonStyle.Secondary);
        phaseButtons = [roundDurationButton, ...phaseButtons];
        const rows = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(basicInfoButton),
            new ActionRowBuilder<ButtonBuilder>().addComponents(phaseButtons)
        ];

        await interaction.update({ embeds: [embed], components: rows });
    }

    private async handleShowBasicInfoForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        const topic: Topic = await fundingRound.getTopic()

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('This interaction does not support modals.');
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_BASIC_INFO, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
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

        const topicIntput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.TOPIC_NAME)
            .setLabel('Topic Name')
            .setStyle(TextInputStyle.Short)
            .setValue(topic.name)
            .setRequired(true);

        const stLedgerInput = new TextInputBuilder()
            .setCustomId(ModifyFundingRoundAction.INPUT_IDS.STAKING_LEDGER_EPOCH)
            .setLabel('Staking Ledger Epoch Number (For Voting)')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.stakingLedgerEpoch.toString())
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(topicIntput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stLedgerInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitBasicInfo(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('Invalid interaction type.')
            throw new EndUserError('Invalid interaction type ' + interaction.interaction);

        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        const name = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.DESCRIPTION);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.BUDGET));
        const stLedger = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.STAKING_LEDGER_EPOCH);
        const topicName = modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.TOPIC_NAME);

        const topic = await TopicLogic.getTopicByName(topicName)

        if (!topic) {
            await interaction.respond({ content: `No Topic with name ${topicName} found`, ephemeral: true });
            return;
        }

        if (isNaN(budget)) {
            throw new EndUserError('Invalid budget value. Please enter a valid number.');
        }

        if (isNaN(parseInt(stLedger))) {
            throw new EndUserError('Invalid staking ledger epoch number. Please enter a valid number.');
        }

        const ledgerNum: number = parseInt(stLedger);

        try {
            const updatedFundingRound = await FundingRoundLogic.updateFundingRound(parseInt(fundingRoundId), {
                name,
                description,
                budget,
                stakingLedgerEpoch: ledgerNum,
                topicId: topic.id,
            });

            if (!updatedFundingRound) {
                throw new EndUserError('Funding round not found.');
            };

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Updated')
                .setDescription('The funding round has been successfully updated.')
                .addFields(
                    { name: 'Name', value: updatedFundingRound.name },
                    { name: 'Description', value: updatedFundingRound.description },
                    { name: 'Topic', value: topic.name },
                    { name: 'Budget', value: updatedFundingRound.budget.toString() },
                    { name: 'Staking Ledger Epoch Number (For Voting)', value: updatedFundingRound.stakingLedgerEpoch.toString() }
                );

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error updating funding round: ${errorMessage}`, ephemeral: true });
        }
    }

    private async handleShowPhaseForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        let phase = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.PHASE) as 'consideration' | 'deliberation' | 'voting' | 'round';
        phase = phase.toLowerCase() as 'consideration' | 'deliberation' | 'voting' | 'round';

        if (!fundingRoundId || !phase) {
            throw new EndUserError('Invalid funding round ID or phase.');
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('This interaction does not support modals.');
        }

        const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
        const existingPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === phase);

        const title: string = phase === 'round' ? 'Modify Round Dates' : `Modify ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase Dates`;
        const startDateCustomId: string = phase === 'round' ? ModifyFundingRoundAction.INPUT_IDS.ROUND_START_DATE : ModifyFundingRoundAction.INPUT_IDS.START_DATE;
        const endDateCustomId: string = phase === 'round' ? ModifyFundingRoundAction.INPUT_IDS.ROUND_END_DATE : ModifyFundingRoundAction.INPUT_IDS.END_DATE;

        const startDateValue: string = phase === 'round' && fundingRound.startAt ? this.formatDate(fundingRound.startAt) : existingPhase ? this.formatDate(existingPhase.startDate) : '';
        const endDateValue: string = phase === 'round' && fundingRound.startAt ? this.formatDate(fundingRound.endAt) : existingPhase ? this.formatDate(existingPhase.endDate) : '';

        logger.info(`startDateValue: ${startDateValue} endDateValue: ${endDateValue}`);

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SUBMIT_PHASE, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, ArgumentOracle.COMMON_ARGS.PHASE, phase))
            .setTitle(title);

        const startDateInput = new TextInputBuilder()
            .setCustomId(startDateCustomId)
            .setLabel('Start Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(startDateValue)
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId(endDateCustomId)
            .setLabel('End Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(endDateValue)
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
            throw new EndUserError('Invalid interaction type.')
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.PHASE) as 'consideration' | 'deliberation' | 'voting' | 'round';

        if (!fundingRoundId || !phase) {
            throw new EndUserError('Invalid funding round ID or phase.');
        }

        let startDate: Date;
        let endDate: Date;
        if (phase === 'round') {
            startDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.ROUND_START_DATE));
            endDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.ROUND_END_DATE));
        } else {
            startDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.START_DATE));
            endDate = new Date(modalInteraction.fields.getTextInputValue(ModifyFundingRoundAction.INPUT_IDS.END_DATE));
        }


        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new EndUserError('Invalid date format. Please use YYYY-MM-DD HH:MM.');
        }

        if (startDate >= endDate) {
            throw new EndUserError('Start date must be before end date.');
        }

        try {
            const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
            if (!fundingRound) {
                throw new EndUserError('Funding round not found.');
            }

            const existingPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));

            // Check phase order
            if (phase === 'deliberation') {
                const considerationPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === 'consideration');
                if (considerationPhase && startDate < considerationPhase.endDate) {
                    throw new EndUserError('Deliberation phase must start after Consideration phase ends.');
                }
            } else if (phase === 'voting') {
                const deliberationPhase = existingPhases.find((p: FundingRoundPhase) => p.phase === 'deliberation');
                if (deliberationPhase && startDate < deliberationPhase.endDate) {
                    throw new EndUserError('Voting phase must start after Deliberation phase ends.');
                }
            }

            await FundingRoundLogic.setFundingRoundPhase(parseInt(fundingRoundId), phase, startDate, endDate);

            const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(parseInt(fundingRoundId));
            let allPhasesSet: boolean = ['consideration', 'deliberation', 'voting']
                .every(phaseName => updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));

            allPhasesSet = allPhasesSet && (fundingRound.startAt !== null) && (fundingRound.endAt !== null);

            fundingRound.reload();

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Phase Updated')
                .setDescription(`The ${phase} phase has been updated successfully.`)
                .addFields(
                    { name: 'Name', value: fundingRound.name },
                    { name: 'Description', value: fundingRound.description },
                    { name: 'Budget', value: fundingRound.budget.toString() },
                    { name: 'Staking Ledger Epoch Number (For Voting)', value: fundingRound.stakingLedgerEpoch.toString() },
                    { name: 'Start Date', value: fundingRound.startAt ? this.formatDate(fundingRound.startAt) : '❌ Not set' },
                    { name: 'End Date', value: fundingRound.endAt ? this.formatDate(fundingRound.endAt) : '❌ Not set' },
                    ...updatedPhases.map((p: FundingRoundPhase) => ({ name: `${p.phase.charAt(0).toUpperCase() + p.phase.slice(1)} Phase`, value: `Start: ${this.formatDate(p.startDate)}\nEnd: ${this.formatDate(p.endDate)}`, inline: true }))
                );

            if (allPhasesSet) {
                embed.addFields({ name: 'Status', value: 'All phases have been set for the funding round.' });
            } else {
                const remainingPhases = ['consideration', 'deliberation', 'voting']
                    .filter(phaseName => !updatedPhases.some((p: FundingRoundPhase) => p.phase === phaseName));

                embed.addFields({ name: 'Remaining Phases', value: remainingPhases.join(', ') });

                if (fundingRound.startAt === null || fundingRound.endAt === null) {
                    embed.addFields({ name: 'Remaining Phases', value: 'Funding Round Duration' });
                }
            }

            const backButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
                .setLabel('Back to Funding Round')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error updating phase: ${errorMessage}`, ephemeral: true });
            throw error;
        }
    }

    private formatDate(date: Date): string {
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }

    public allSubActions(): Action[] {
        return [this.fundingRoundPaginationAction];
    }

    private async handleEditFundingRound(interaction: TrackedInteraction): Promise<void> {
        await (this.screen as ManageFundingRoundsScreen).selectFundingRoundToEditAction.handleOperation(
            interaction,
            SelectFundingRoundToEditAction.OPERATIONS.SHOW_FUNDING_ROUNDS
        );
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.EDIT_FUNDING_ROUND))
            .setLabel('Edit Funding Round')
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

    protected async getTotalPages(interaction: TrackedInteraction, fundingRoundId?: number): Promise<number> {
        let parsedFundingRoundId: number;
        if (fundingRoundId === undefined) {
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
            if (!fundingRoundIdFromCustomId) {
                throw new EndUserError('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parsedFundingRoundId);
        if (!fundingRound) {
            throw new EndUserError('Funding round not found');
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
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
            if (!fundingRoundIdFromCustomId) {
                throw new EndUserError('Invalid funding round ID');
            }
            parsedFundingRoundId = parseInt(fundingRoundIdFromCustomId);
        } else {
            parsedFundingRoundId = fundingRoundId;
        }

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parsedFundingRoundId);
        if (!fundingRound) {
            throw new EndUserError('Funding round not found: ' + parsedFundingRoundId);
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
            fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
            if (!fundingRoundId) {
                throw new EndUserError('No values and no fundingRound in customId')
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
            //throw new EndUserError('This funding round does not have a required committee set on the Topic.')
        }
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SELECT_COMMITTEE_MEMBERS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
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
            throw new EndUserError('Invalid interaction type.')
            throw new EndUserError('Invalid interaction type ' + interaction.interaction);
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        const selectedMembers = interactionWithValues.values;

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
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
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
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
            throw new EndUserError('Invalid interaction type.')
        }

        const fundingRoundId = parseInt(interactionWithValues.values[0]);
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
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
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.EXECUTE_APPROVAL, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ApproveFundingRoundAction.OPERATIONS.EXECUTE_REJECTION, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(approveButton, rejectButton);

        await interaction.update({ embeds: [embed], components: [row] });
    }

    private async handleExecuteApproval(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        try {
            const approvedFundingRound = await FundingRoundLogic.approveFundingRound(parseInt(fundingRoundId));
            if (!approvedFundingRound) {
                throw new EndUserError('Funding round not found.');
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
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        try {
            const rejectedFundingRound = await FundingRoundLogic.rejectFundingRound(parseInt(fundingRoundId));
            if (!rejectedFundingRound) {
                throw new EndUserError('Funding round not found.');
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
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
            if (!fundingRoundIdFromCustomId) {
                throw new EndUserError('Invalid funding round ID');
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
            const fundingRoundIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
            if (!fundingRoundIdFromCustomId) {
                throw new EndUserError('Invalid funding round ID');
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
            throw new EndUserError('Invalid interaction type.');
        }

        const fundingRoundId = interactionWithValues.values[0];
        await this.showMemberRemovalSelection(interaction, parseInt(fundingRoundId));
    }

    private async showMemberRemovalSelection(interaction: TrackedInteraction, fundingRoundId: number): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction, fundingRoundId);
        const members = await this.getItemsForPage(interaction, currentPage, fundingRoundId);

        if (members.length === 0) {
            throw new EndUserError('This funding round does not have any committee members.');
        }

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_MEMBERS_TO_REMOVE, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setPlaceholder('Select members to remove')
            .setMaxValues(25);

        const removeAllButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveFundingRoundCommitteeAction.OPERATIONS.REMOVE_ALL_MEMBERS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
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
            throw new EndUserError('Invalid interaction type.');
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        if (!fundingRoundId) {
            throw new EndUserError('Invalid funding round ID.');
        }

        const selectedMembers = interactionWithValues.values;

        const numRemovedRecords = await FundingRoundLogic.removeFundingRoundCommitteeMembers(parseInt(fundingRoundId), selectedMembers);

        await this.showCommitteeStatus(interaction, parseInt(fundingRoundId), numRemovedRecords);
    }

    private async handleRemoveAllMembers(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

        const numRemovedRecords = await FundingRoundLogic.removeAllFundingRoundCommitteeMembers(parseInt(fundingRoundId));

        await this.showCommitteeStatus(interaction, parseInt(fundingRoundId), numRemovedRecords);
    }

    private async showCommitteeStatus(interaction: TrackedInteraction, fundingRoundId: number, numRemovedRecords: number): Promise<void> {
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
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

export class SelectFundingRoundToEditAction extends PaginationComponent {
    public static readonly ID = 'selectFundingRoundToEdit';

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        SELECT_FUNDING_ROUND: 'selectFundingRound',
    };

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const fundingRounds = await FundingRoundLogic.getActiveFundingRounds();
        return Math.ceil(fundingRounds.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
        const fundingRounds = await FundingRoundLogic.getActiveFundingRounds();
        return fundingRounds.slice(page * 25, (page + 1) * 25);
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SelectFundingRoundToEditAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case SelectFundingRoundToEditAction.OPERATIONS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
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
            throw new EndUserError('There are no active funding rounds to edit.');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Select a Funding Round to Edit')
            .setDescription(`Please select a funding round to edit. Page ${currentPage + 1} of ${totalPages}`);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectFundingRoundToEditAction.OPERATIONS.SELECT_FUNDING_ROUND))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map(fr => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Status: ${fr.status}, Budget: ${fr.budget}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [row];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.respond({ embeds: [embed], components, ephemeral: true });
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0);
        interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId);
        await (this.screen as ManageFundingRoundsScreen).editFundingRoundTypeSelectionAction.handleOperation(
            interaction,
            EditFundingRoundTypeSelectionAction.OPERATIONS.SHOW_EDIT_OPTIONS,
        );
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectFundingRoundToEditAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
            .setLabel('Edit Funding Round')
            .setStyle(ButtonStyle.Primary);
    }
}

export class EditFundingRoundTypeSelectionAction extends Action {
    public static readonly ID = 'editFundingRoundTypeSelection';

    public static readonly OPERATIONS = {
        SHOW_EDIT_OPTIONS: 'showEditOptions',
        SELECT_EDIT_TYPE: 'selectEditType',
    };

    public static readonly EDIT_TYPES = {
        INFO: 'info',
        PHASES: 'phases',
        TOPIC: 'topic',
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case EditFundingRoundTypeSelectionAction.OPERATIONS.SHOW_EDIT_OPTIONS:
                await this.handleShowEditOptions(interaction);
                break;
            case EditFundingRoundTypeSelectionAction.OPERATIONS.SELECT_EDIT_TYPE:
                await this.handleSelectEditType(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }
    private async handleShowEditOptions(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            throw new EndUserError(`Funding round not found. ID: ${fundingRoundId}`);
        }

        const topic: Topic = await TopicLogic.getByIdOrError(fundingRound.topicId);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Edit Funding Round: ${fundingRound.name}`)
            .setDescription('Select the type of edit you want to make:')
            .addFields(
                { name: 'Name', value: fundingRound.name, inline: true },
                { name: 'Description', value: fundingRound.description, inline: true },
                { name: 'Budget', value: fundingRound.budget.toString(), inline: true },
                { name: 'Status', value: fundingRound.status, inline: true },
                { name: 'Staking Ledger Epoch', value: fundingRound.stakingLedgerEpoch.toString(), inline: true },
                { name: 'Topic ID', value: fundingRound.topicId.toString(), inline: true },
                { name: 'Topic Name', value: topic.name, inline: true },
            );

        const editInfoButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundTypeSelectionAction.OPERATIONS.SELECT_EDIT_TYPE, 'type', EditFundingRoundTypeSelectionAction.EDIT_TYPES.INFO, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Edit Funding Round Information')
            .setStyle(ButtonStyle.Primary);

        const editPhasesButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundTypeSelectionAction.OPERATIONS.SELECT_EDIT_TYPE, 'type', EditFundingRoundTypeSelectionAction.EDIT_TYPES.PHASES, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Edit Funding Round Phases')
            .setStyle(ButtonStyle.Primary);

        const editTopicButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundTypeSelectionAction.OPERATIONS.SELECT_EDIT_TYPE, 'type', EditFundingRoundTypeSelectionAction.EDIT_TYPES.TOPIC, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Edit Topic')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(editInfoButton, editPhasesButton, editTopicButton);
        

        await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
    }

    private async handleSelectEditType(interaction: TrackedInteraction): Promise<void> {
        const editType = ArgumentOracle.getNamedArgument(interaction, 'type');
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));

        const screen = this.screen as ManageFundingRoundsScreen;

        interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString());

        switch (editType) {
            case EditFundingRoundTypeSelectionAction.EDIT_TYPES.INFO:
                await screen.editFundingRoundInformationAction.handleOperation(
                    interaction,
                    EditFundingRoundInformationAction.OPERATIONS.SHOW_EDIT_FORM,
                );
                break;
            case EditFundingRoundTypeSelectionAction.EDIT_TYPES.PHASES:
                await screen.editFundingRoundPhasesAction.handleOperation(
                    interaction,
                    EditFundingRoundPhasesAction.OPERATIONS.SHOW_PHASE_OPTIONS,
                );
                break;
            case EditFundingRoundTypeSelectionAction.EDIT_TYPES.TOPIC:
                await screen.editFundingRoundTopicAction.handleOperation(
                    interaction,
                    EditFundingRoundTopicAction.OPERATIONS.SHOW_TOPIC_SELECTION,
                );
                break;
            default:
                throw new EndUserError('Invalid edit type selected.');
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        throw new Error('EditFundingRoundTypeSelectionAction does not have a standalone component.');
    }
}

export class EditFundingRoundInformationAction extends Action {
    public static readonly ID = 'editFundingRoundInformation';

    public static readonly OPERATIONS = {
        SHOW_EDIT_FORM: 'showEditForm',
        SUBMIT_EDIT: 'submitEdit',
    };

    private static readonly INPUT_IDS = {
        NAME: 'name',
        DESCRIPTION: 'description',
        BUDGET: 'budget',
        STAKING_LEDGER_EPOCH: 'stakingLedgerEpoch',
    };

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case EditFundingRoundInformationAction.OPERATIONS.SHOW_EDIT_FORM:
                await this.handleShowEditForm(interaction);
                break;
            case EditFundingRoundInformationAction.OPERATIONS.SUBMIT_EDIT:
                await this.handleSubmitEdit(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowEditForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundInformationAction.OPERATIONS.SUBMIT_EDIT, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setTitle('Edit Funding Round Information');

        const nameInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundInformationAction.INPUT_IDS.NAME)
            .setLabel('Funding Round Name')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.name)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundInformationAction.INPUT_IDS.DESCRIPTION)
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(fundingRound.description)
            .setRequired(true);

        const budgetInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundInformationAction.INPUT_IDS.BUDGET)
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.budget.toString())
            .setRequired(true);

        const stakingLedgerEpochInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundInformationAction.INPUT_IDS.STAKING_LEDGER_EPOCH)
            .setLabel('Staking Ledger Epoch Number')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.stakingLedgerEpoch.toString())
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerEpochInput)
        );

        await interaction.showModal(modal);
    }

    private async handleSubmitEdit(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrError(interaction.interaction);

        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID)); 

        const name = modalInteraction.fields.getTextInputValue(EditFundingRoundInformationAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(EditFundingRoundInformationAction.INPUT_IDS.DESCRIPTION);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(EditFundingRoundInformationAction.INPUT_IDS.BUDGET));
        const stakingLedgerEpoch = parseInt(modalInteraction.fields.getTextInputValue(EditFundingRoundInformationAction.INPUT_IDS.STAKING_LEDGER_EPOCH));

        if (isNaN(budget) || isNaN(stakingLedgerEpoch)) {
            throw new EndUserError('Invalid budget or staking ledger epoch value.');
        }

        try {
            const updatedFundingRound: FundingRound | null = await FundingRoundLogic.updateFundingRound(fundingRoundId, {
                name,
                description,
                budget,
                stakingLedgerEpoch,
            });

            if (!updatedFundingRound) {
                throw new EndUserError('Funding round not found.');
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Updated')
                .setDescription(`The funding round "${updatedFundingRound.name}" has been successfully updated.`)
                .addFields(
                    { name: 'Name', value: updatedFundingRound.name, inline: true },
                    { name: 'Description', value: updatedFundingRound.description, inline: true },
                    { name: 'Budget', value: updatedFundingRound.budget.toString(), inline: true },
                    { name: 'Staking Ledger Epoch', value: updatedFundingRound.stakingLedgerEpoch.toString(), inline: true }
                );

            // There is no back button here, because it's a reply to modal, so cannot unsend
            await interaction.respond({ embeds: [embed], ephemeral: true });
        } catch (error) {
            throw new EndUserError('Failed to update funding round', error);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        throw new Error('EditFundingRoundInformationAction does not have a standalone component.');
    }
}

export class EditFundingRoundPhasesAction extends Action {
    public static readonly ID = 'editFundingRoundPhases';

    public static readonly OPERATIONS = {
        SHOW_PHASE_OPTIONS: 'SPO',
        EDIT_PHASE: 'EP',
        SUBMIT_PHASE_EDIT: 'SPE',
    };

    private static readonly INPUT_IDS = {
        START_DATE: 'startDate',
        END_DATE: 'endDate',
    };

    private static readonly PHASE_NAMES = {
        ROUND: 'round',
        CONSIDERATION: 'consideration',
        DELIBERATION: 'deliberation',
        VOTING: 'voting',
    };

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case EditFundingRoundPhasesAction.OPERATIONS.SHOW_PHASE_OPTIONS:
                await this.handleShowPhaseOptions(interaction);
                break;
            case EditFundingRoundPhasesAction.OPERATIONS.EDIT_PHASE:
                await this.handleEditPhase(interaction);
                break;
            case EditFundingRoundPhasesAction.OPERATIONS.SUBMIT_PHASE_EDIT:
                await this.handleSubmitPhaseEdit(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }
    private async handleShowPhaseOptions(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Edit Phases: ${fundingRound.name}`)
            .setDescription('Select a phase to edit:')
            .addFields(
                { name: 'Funding Round Duration', value: `Start: ${fundingRound.startAt?.toISOString() || 'Not set'}\nEnd: ${fundingRound.endAt?.toISOString() || 'Not set'}`, inline: false },
            );

        const phases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);
        for (const phase of phases) {
            embed.addFields({ name: `${phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1)} Phase`, value: `Start: ${phase.startDate.toISOString()}\nEnd: ${phase.endDate.toISOString()}`, inline: false });
        }

        const buttons = Object.values(EditFundingRoundPhasesAction.PHASE_NAMES).map(phase =>
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundPhasesAction.OPERATIONS.EDIT_PHASE, ArgumentOracle.COMMON_ARGS.PHASE, phase, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
                .setLabel(`Edit ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`)
                .setStyle(ButtonStyle.Danger)
        );

        const backToEditFundingRoundBtn: ButtonBuilder = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).selectFundingRoundToEditAction, SelectFundingRoundToEditAction.OPERATIONS.SELECT_FUNDING_ROUND, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel('Back to Edit Funding Round')
            .setStyle(ButtonStyle.Primary);

        const rows = buttons.map(button => new ActionRowBuilder<ButtonBuilder>().addComponents(button));
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(backToEditFundingRoundBtn));

        await interaction.update({ embeds: [embed], components: rows, ephemeral: true });
    }

    private async handleEditPhase(interaction: TrackedInteraction): Promise<void> {
        const phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));

        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        let startDate, endDate;
        if (phase === EditFundingRoundPhasesAction.PHASE_NAMES.ROUND) {
            startDate = fundingRound.startAt;
            endDate = fundingRound.endAt;
        } else {
            const phaseData = await FundingRoundLogic.getFundingRoundPhase(fundingRoundId, phase);
            startDate = phaseData?.startAt;
            endDate = phaseData?.endAt;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundPhasesAction.OPERATIONS.SUBMIT_PHASE_EDIT, ArgumentOracle.COMMON_ARGS.PHASE, phase, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setTitle(`Edit ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`);

        const startDateInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundPhasesAction.INPUT_IDS.START_DATE)
            .setLabel('Start Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(startDate ? this.formatDate(startDate) : '')
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundPhasesAction.INPUT_IDS.END_DATE)
            .setLabel('End Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(endDate ? this.formatDate(endDate) : '')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput)
        );

        await interaction.showModal(modal);
    }

    private async handleSubmitPhaseEdit(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('Invalid interaction type.');
        }

        const phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);
        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));

        if (!phase || !fundingRoundId) {
            throw new EndUserError('Invalid phase or funding round ID.');
        }

        const startDate = new Date(modalInteraction.fields.getTextInputValue(EditFundingRoundPhasesAction.INPUT_IDS.START_DATE));
        const endDate = new Date(modalInteraction.fields.getTextInputValue(EditFundingRoundPhasesAction.INPUT_IDS.END_DATE));

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new EndUserError('Invalid date format. Please use YYYY-MM-DD HH:MM.');
        }

        if (startDate >= endDate) {
            throw new EndUserError('Start date must be before end date.');
        }

        const stringPhase: FundingRoundMIPhaseValue = FundingRoundMI.toFundingRoundPhaseFromString(phase);

        try {
            if (phase === EditFundingRoundPhasesAction.PHASE_NAMES.ROUND) {
                await FundingRoundLogic.updateFundingRound(fundingRoundId, { startAt: startDate, endAt: endDate });
            } else {
                await FundingRoundLogic.setFundingRoundPhase(fundingRoundId, stringPhase, startDate, endDate);
            }

            const updatedFundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
            const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Phase Updated')
                .setDescription(`The ${phase} phase for "${updatedFundingRound?.name}" has been successfully updated.`)
                .addFields(
                    { name: 'Funding Round Duration', value: `Start: ${updatedFundingRound?.startAt?.toISOString() || 'Not set'}\nEnd: ${updatedFundingRound?.endAt?.toISOString() || 'Not set'}`, inline: false },
                );

            for (const updatedPhase of updatedPhases) {
                embed.addFields({ name: `${updatedPhase.phase.charAt(0).toUpperCase() + updatedPhase.phase.slice(1)} Phase`, value: `Start: ${updatedPhase.startDate.toISOString()}\nEnd: ${updatedPhase.endDate.toISOString()}`, inline: false });
            }

            const backButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditFundingRoundPhasesAction.OPERATIONS.SHOW_PHASE_OPTIONS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
                .setLabel('Back to Phase Options')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
        } catch (error) {
            throw new EndUserError('Failed to update funding round phase', error);
        }
    }

    private formatDate(date: Date): string {
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        throw new Error('EditFundingRoundPhasesAction does not have a standalone component.');
    }
}

export class EditFundingRoundTopicAction extends PaginationComponent {
    public static readonly ID = 'editFundingRoundTopic';

    public static readonly OPERATIONS = {
        SHOW_TOPIC_SELECTION: 'showTopicSelection',
        SELECT_TOPIC: 'selectTopic',
    };


    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const topics = await TopicLogic.getAllTopics();
        return Math.ceil(topics.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<Topic[]> {
        const topics = await TopicLogic.getAllTopics();
        return topics.slice(page * 25, (page + 1) * 25);
    }

    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const topics = await this.getItemsForPage(interaction, currentPage);

        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

        const fundingRound = await FundingRoundLogic.getFundingRoundById(parseInt(fundingRoundId));
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        const paginationArgs: string[] = [ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId];

        const handlerCustomId: string = CustomIDOracle.addArgumentsToAction(this, EditFundingRoundTopicAction.OPERATIONS.SELECT_TOPIC, ...paginationArgs);
        logger.info(handlerCustomId);
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(handlerCustomId)
            .setPlaceholder('Select a new topic')
            .addOptions(topics
                .filter(topic => topic.id !== fundingRound.topicId)
                .map(topic => ({
                    label: topic.name,
                    value: topic.id.toString(),
                    description: topic.description.substring(0, 100)
                }))
            );

        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages, ...paginationArgs);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case EditFundingRoundTopicAction.OPERATIONS.SHOW_TOPIC_SELECTION:
            case PaginationComponent.PAGINATION_ARG:
                await this.handlePagination(interaction);
                break;
            case EditFundingRoundTopicAction.OPERATIONS.SELECT_TOPIC:
                await this.handleSelectTopic(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }


    private async handleSelectTopic(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrError(interaction.interaction);
        const newTopicId: number = parseInt(interactionWithValues.values[0]);

        const fundingRoundIdStr: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const fundingRoundId: number = parseInt(fundingRoundIdStr);

        try {
            const updatedFundingRound = await FundingRoundLogic.updateFundingRound(fundingRoundId, { topicId: newTopicId });
            const newTopic = await TopicLogic.getTopicById(newTopicId);

            if (!updatedFundingRound) {
                throw new EndUserError('Funding round not found.');
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Topic Updated')
                .setDescription(`The topic for "${updatedFundingRound.name}" has been successfully updated.`)
                .addFields(
                    { name: 'New Topic', value: newTopic ? newTopic.name : 'Not found', inline: false },
                    { name: 'Description', value: newTopic ? newTopic.description : 'Not available', inline: false }
                );

            const backButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).editFundingRoundTypeSelectionAction, EditFundingRoundTypeSelectionAction.OPERATIONS.SHOW_EDIT_OPTIONS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
                .setLabel('Back to Edit Options')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
        } catch (error) {
            throw new EndUserError('Failed to update funding round topic', error);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        throw new Error('EditFundingRoundTopicAction does not have a standalone component.');
    }
}