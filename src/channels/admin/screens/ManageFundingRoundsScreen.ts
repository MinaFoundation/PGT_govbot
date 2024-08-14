import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, TextInputStyle, TextInputBuilder, ModalBuilder, UserSelectMenuBuilder, User, ForumChannel, ChannelType } from 'discord.js';
import { FundingRoundLogic } from './FundingRoundLogic';
import { ArgumentOracle, CustomIDOracle } from '../../../CustomIDOracle';
import { ConsiderationPhase, DeliberationPhase, FundingRound, FundingVotingPhase, SMEGroup, Topic, TopicCommittee } from '../../../models';
import { InteractionProperties } from '../../../core/Interaction';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { FundingRoundPhase, FundingRoundStatus } from '../../../types';
import { TopicLogic } from './ManageTopicLogicScreen';
import logger from '../../../logging';
import { EndUserError, NotFoundEndUserError } from '../../../Errors';
import { DiscordStatus } from '../../DiscordStatus';
import { FundingRoundMI, FundingRoundMIPhaseValue } from '../../../models/Interface';
import { InputDate } from '../../../dates/Input';
import { ExclusionConstraintError } from 'sequelize';
import { FundingRoundPaginator } from '../../../components/FundingRoundPaginator';



export class ManageFundingRoundsScreen extends Screen {
    public static readonly ID = 'manageFundingRounds';

    protected permissions: Permission[] = []; // TODO: Implement proper admin permissions

    public readonly createFundingRoundAction: CreateOrEditFundingRoundAction;
    public readonly modifyFundingRoundAction: ModifyFundingRoundAction;
    public readonly setFundingRoundCommitteeAction: SetFundingRoundCommitteeAction;
    public readonly removeFundingRoundCommitteeAction: RemoveFundingRoundCommitteeAction;
    public readonly approveFundingRoundAction: ApproveFundingRoundAction;
    public readonly selectFundingRoundToEditAction: SelectFundingRoundToEditAction;
    public readonly editFundingRoundTypeSelectionAction: EditFundingRoundTypeSelectionAction;
    public readonly editFundingRoundInformationAction: EditFundingRoundInformationAction;
    public readonly editFundingRoundPhasesAction: EditFundingRoundPhasesAction;
    public readonly editFundingRoundTopicAction: EditFundingRoundTopicAction;
    public readonly selectTopicAction: SelectTopicAction;
    public readonly coreInformationAction: CoreInformationAction;
    public readonly setPhaseAction: SetPhaseAction;
    public readonly selectForumChannelAction: SelectForumChannelAction;

    public readonly crudFRPaginatorAction: FundingRoundPaginator;
    public readonly committeeFRPaginator: FundingRoundPaginator;
    public readonly committeeDeleteFRPaginator: FundingRoundPaginator;
    public readonly approveRejectFRPaginator: FundingRoundPaginator;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.createFundingRoundAction = new CreateOrEditFundingRoundAction(this, CreateOrEditFundingRoundAction.ID);
        this.modifyFundingRoundAction = new ModifyFundingRoundAction(this, ModifyFundingRoundAction.ID);
        this.setFundingRoundCommitteeAction = new SetFundingRoundCommitteeAction(this, SetFundingRoundCommitteeAction.ID);
        this.removeFundingRoundCommitteeAction = new RemoveFundingRoundCommitteeAction(this, RemoveFundingRoundCommitteeAction.ID);
        this.approveFundingRoundAction = new ApproveFundingRoundAction(this, ApproveFundingRoundAction.ID);
        this.selectFundingRoundToEditAction = new SelectFundingRoundToEditAction(this, SelectFundingRoundToEditAction.ID);
        this.editFundingRoundTypeSelectionAction = new EditFundingRoundTypeSelectionAction(this, EditFundingRoundTypeSelectionAction.ID);
        this.editFundingRoundInformationAction = new EditFundingRoundInformationAction(this, EditFundingRoundInformationAction.ID);
        this.editFundingRoundPhasesAction = new EditFundingRoundPhasesAction(this, EditFundingRoundPhasesAction.ID);
        this.editFundingRoundTopicAction = new EditFundingRoundTopicAction(this, EditFundingRoundTopicAction.ID);

        this.selectTopicAction = new SelectTopicAction(this, SelectTopicAction.ID);
        this.coreInformationAction = new CoreInformationAction(this, CoreInformationAction.ID);
        this.setPhaseAction = new SetPhaseAction(this, SetPhaseAction.ID);
        this.selectForumChannelAction = new SelectForumChannelAction(this, SelectForumChannelAction.ID);

        this.crudFRPaginatorAction = new FundingRoundPaginator(this, this.createFundingRoundAction, CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS, [], 'Select a Funding Round To Edit');
        this.committeeFRPaginator = new FundingRoundPaginator(this, this.setFundingRoundCommitteeAction , SetFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND, [], "Select a Funding Round To Manage Committee")
        this.committeeDeleteFRPaginator = new FundingRoundPaginator(this, this.removeFundingRoundCommitteeAction, RemoveFundingRoundCommitteeAction.OPERATIONS.SELECT_FUNDING_ROUND, [], "Select a Funding Round To Remove Committee")
        this.approveRejectFRPaginator = new FundingRoundPaginator(this, this.approveFundingRoundAction, ApproveFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND, [], "Select a Funding Round To Approve/Reject")
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
            this.selectTopicAction,
            this.coreInformationAction,
            this.setPhaseAction,
            this.selectForumChannelAction,

            this.crudFRPaginatorAction
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

export class CreateOrEditFundingRoundAction extends Action {
    public static readonly ID = 'createFundingRound';

    public static readonly OPERATIONS = {
        START: 'start',
        SHOW_PROGRESS: 'showProgress',
    };

    public static BOOLEANS = {
        TRUE_VALUE: 'T',
        ARGUMENTS: {
            ONLY_SHOW_PHASES: 'bOSP',
            FORCE_REPLY: 'bFR',
        }
    }



    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case CreateOrEditFundingRoundAction.OPERATIONS.START:
                await this.handleStart(interaction);
                break;
            case CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS:
                await this.handleShowProgress(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleStart(interaction: TrackedInteraction): Promise<void> {
        const isForceReply: boolean = ArgumentOracle.isArgumentEquals(interaction, CreateOrEditFundingRoundAction.BOOLEANS.ARGUMENTS.FORCE_REPLY, CreateOrEditFundingRoundAction.BOOLEANS.TRUE_VALUE);
        await (this.screen as ManageFundingRoundsScreen).selectTopicAction.handlePagination(interaction, isForceReply);
    }

    private formatStringForPhase(phase: ConsiderationPhase | DeliberationPhase | FundingVotingPhase): string {

        return `✅\nStart: ${phase.startAt.toUTCString()}\nEnd: ${phase.endAt.toUTCString()}\nEpoch: ${phase.stakingLedgerEpoch}`;
    }

    private formatStringForRound(fundingRound: FundingRound): string {
        return `✅\nStart: ${fundingRound.startAt.toUTCString()}\nEnd: ${fundingRound.endAt.toUTCString()}\nVoting Open Until: ${fundingRound.votingOpenUntil.toUTCString()}\nEpoch: ${fundingRound.stakingLedgerEpoch}`;
    }

    private async handleShowProgress(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, 'fundingRoundId', 0);
        const fundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(parseInt(fundingRoundId));
        const topic: Topic = await fundingRound.getTopic();
        const onlyShowPhases: boolean = ArgumentOracle.isArgumentEquals(interaction, CreateOrEditFundingRoundAction.BOOLEANS.ARGUMENTS.ONLY_SHOW_PHASES, CreateOrEditFundingRoundAction.BOOLEANS.TRUE_VALUE);

        const considerationPhase = await fundingRound.getConsiderationPhase();
        const deliberationPhase = await fundingRound.getDeliberationPhase();
        const votingPhase = await fundingRound.getFundingVotingPhase();

        const progress: string = await fundingRound.isReady() ? '✅ READY\n\nThe Funding Round information is complete & valid.' : '⚠️ NOT READY\nSome Funding Round information is missing (marked with ❌). Please complete filling all of the information below';
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Create or Edit Funding Round')
            .setDescription(`Status: ${progress}`)
            .addFields(
                { name: 'Topic', value: fundingRound.topicId ? `✅\n${topic.name}` : '❌', inline: true },
                { name: 'Core Information', value: fundingRound.name && fundingRound.description && fundingRound.budget ? `✅\nName: ${fundingRound.name}\nDescription: ${fundingRound.description}\nBudget: ${fundingRound.budget}` : '❌', inline: true },
                { name: 'Funding Round Dates', value: fundingRound.startAt && fundingRound.endAt && fundingRound.votingOpenUntil ? this.formatStringForRound(fundingRound) : '❌', inline: true },
                { name: 'Consideration Phase', value: considerationPhase ? this.formatStringForPhase(considerationPhase) : '❌', inline: true },
                { name: 'Deliberation Phase', value: deliberationPhase ? this.formatStringForPhase(deliberationPhase) : '❌', inline: true },
                { name: 'Voting Phase', value: votingPhase ? this.formatStringForPhase(votingPhase) : '❌', inline: true },
                { name: 'Forum Channel', value: fundingRound.forumChannelId ? `✅ ${fundingRound.forumChannelId}` : '❌', inline: true },
            );

        const manageDatesCustomId: string = CustomIDOracle.addArgumentsToAction(this, CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, CreateOrEditFundingRoundAction.BOOLEANS.ARGUMENTS.ONLY_SHOW_PHASES, CreateOrEditFundingRoundAction.BOOLEANS.TRUE_VALUE);
        logger.info(manageDatesCustomId)
        const initScreenButtons = [
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).selectTopicAction, SelectTopicAction.OPERATIONS.SHOW_TOPICS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
                .setLabel(fundingRound.topicId ? 'Edit Topic' : 'Select Topic')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).selectForumChannelAction, SelectForumChannelAction.OPERATIONS.SHOW_CHANNELS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
                .setLabel(fundingRound.forumChannelId ? 'Edit Forum Channel' : 'Set Forum Channel')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(manageDatesCustomId)
                .setLabel('Manage Phases & Dates')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).coreInformationAction, CoreInformationAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
                .setLabel('Edit Core Information')
                .setStyle(ButtonStyle.Primary),

        ];

        const phaseDatesOnlyButtons = [
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).setPhaseAction, SetPhaseAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, SetPhaseAction.ARGUMENTS.PHASE, FundingRoundMI.PHASES.ROUND))
                .setLabel(fundingRound.startAt ? 'Edit Funding Round Dates' : 'Set Funding Round Dates')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).setPhaseAction, SetPhaseAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, SetPhaseAction.ARGUMENTS.PHASE, FundingRoundMI.PHASES.CONSIDERATION))
                .setLabel(considerationPhase ? 'Edit Consideration Phase' : 'Set Consideration Phase')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).setPhaseAction, SetPhaseAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, SetPhaseAction.ARGUMENTS.PHASE, FundingRoundMI.PHASES.DELIBERATION))
                .setLabel(deliberationPhase ? 'Edit Deliberation Phase' : 'Set Deliberation Phase')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).setPhaseAction, SetPhaseAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, SetPhaseAction.ARGUMENTS.PHASE, FundingRoundMI.PHASES.VOTING))
                .setLabel(votingPhase ? 'Edit Voting Phase' : 'Set Voting Phase')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
                .setLabel('Go Back')
                .setStyle(ButtonStyle.Secondary)
        ]

        const buttons = onlyShowPhases ? phaseDatesOnlyButtons : initScreenButtons;

        const rows = buttons.map(button => new ActionRowBuilder<ButtonBuilder>().addComponents(button));

        await interaction.update({ embeds: [embed], components: rows, ephemeral: true });
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateOrEditFundingRoundAction.OPERATIONS.START))
            .setLabel('Create Funding Round')
            .setStyle(ButtonStyle.Success);
    }
}

export class SelectTopicAction extends PaginationComponent {
    public static readonly ID = 'selectTopic';

    public static readonly OPERATIONS = {
        SHOW_TOPICS: 'showTopics',
        SELECT_TOPIC: 'selectTopic',
        UPDATE_TOPIC: 'upTp',
    };

    public static readonly INPUT_IDS = {
        TOPIC: 'topic',
    };

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const topics = await TopicLogic.getAllTopics();
        return Math.ceil(topics.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<Topic[]> {
        const topics = await TopicLogic.getAllTopics();
        return topics.slice(page * 25, (page + 1) * 25);
    }

    public async handlePagination(interaction: TrackedInteraction, isForceReply:boolean=false): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const topics = await this.getItemsForPage(interaction, currentPage);


        let fundingRoundId: string | undefined;
        try {
         fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        } catch(error) {
            if (error instanceof NotFoundEndUserError) {
                logger.debug('No funding round ID found in arguments, it means a new funding round is being created');
            }
        }

        const description: string = fundingRoundId ? 'Select a topic to update the Funding Round topic.' : 'Select a topic under which the new Funding Round will be created.';
        const customId: string = fundingRoundId ? CustomIDOracle.addArgumentsToAction(this, SelectTopicAction.OPERATIONS.UPDATE_TOPIC, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId) : CustomIDOracle.addArgumentsToAction(this, SelectTopicAction.OPERATIONS.SELECT_TOPIC);

        const infoEmbed: EmbedBuilder = new EmbedBuilder()
            .setTitle('Select a Topic')
            .setDescription(description);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder('Select a Topic')
            .addOptions(topics.map(topic => ({
                label: topic.name,
                value: topic.id.toString(),
                description: topic.description.substring(0, 100)
            })));

        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
        ];

        const args: string[] = fundingRoundId ? [ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId] : [];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages, ...args);
            components.push(paginationRow);
        }

        const data = { components, embeds: [infoEmbed], ephemeral: true };

        if (isForceReply) {
            await interaction.respond(data);
        } else {
            await interaction.update(data);
        }
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SelectTopicAction.OPERATIONS.SHOW_TOPICS:
            case PaginationComponent.PAGINATION_ARG:
                await this.handlePagination(interaction);
                break;
            case SelectTopicAction.OPERATIONS.SELECT_TOPIC:
                await this.handleSelectTopic(interaction);
                break;
            case SelectTopicAction.OPERATIONS.UPDATE_TOPIC:
                await this.handleUpdateTopic(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleUpdateTopic(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const topicId = ArgumentOracle.getNamedArgument(interaction, SelectTopicAction.INPUT_IDS.TOPIC, 0);

        await FundingRoundLogic.setTopic(parseInt(fundingRoundId), parseInt(topicId));

        interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId);
        await (this.screen as ManageFundingRoundsScreen).createFundingRoundAction.handleOperation(interaction, CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS);
        await DiscordStatus.Success.success(interaction, 'Topic updated successfully');
    }

    private async handleSelectTopic(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrError(interaction.interaction);
        const topicId = interactionWithValues.values[0];

        interaction.Context.set(CoreInformationAction.INPUT_IDS.TOPIC, topicId);

        await (this.screen as ManageFundingRoundsScreen).coreInformationAction.handleOperation(interaction, CoreInformationAction.OPERATIONS.SHOW_FORM);
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectTopicAction.OPERATIONS.SHOW_TOPICS))
            .setLabel('Select Topic')
            .setStyle(ButtonStyle.Primary);
    }
}

export class CoreInformationAction extends Action {
    public static readonly ID = 'coreInformation';

    public static readonly OPERATIONS = {
        SHOW_FORM: 'showForm',
        SUBMIT_FORM: 'submitForm',
    };

    public static readonly INPUT_IDS = {
        NAME: 'name',
        DESCRIPTION: 'description',
        BUDGET: 'budget',
        STAKING_LEDGER_EPOCH: 'stakingLedgerEpoch',
        TOPIC: 'topic',
    };

    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case CoreInformationAction.OPERATIONS.SHOW_FORM:
                await this.handleShowForm(interaction);
                break;
            case CoreInformationAction.OPERATIONS.SUBMIT_FORM:
                await this.handleSubmitForm(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowForm(interaction: TrackedInteraction): Promise<void> {
        let topicId: string | undefined;
        let fundingRoundId: string | undefined;

        try {
            topicId = ArgumentOracle.getNamedArgument(interaction, CoreInformationAction.INPUT_IDS.TOPIC);
        } catch (error) {
            if (error instanceof NotFoundEndUserError) {
                try {
                    fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
                } catch (error) {
                    if (error instanceof NotFoundEndUserError) {
                        throw new EndUserError('Neither topic, nor funding round ID found in arguments.');
                    }
                }
            }
        }

        let nameValue = '';
        let descriptionValue = '';
        let budgetValue = '';
        let stakingLedgerEpochValue = '';

        let parsedTopicId: string;
        if (fundingRoundId) {
            const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(parseInt(fundingRoundId));
            nameValue = fundingRound.name;
            descriptionValue = fundingRound.description;
            budgetValue = fundingRound.budget.toString();
            stakingLedgerEpochValue = fundingRound.stakingLedgerEpoch.toString();
            parsedTopicId = fundingRound.topicId.toString();
        } else {
            parsedTopicId = topicId as string;
        }


        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CoreInformationAction.OPERATIONS.SUBMIT_FORM, CoreInformationAction.INPUT_IDS.TOPIC, parsedTopicId))
            .setTitle('Funding Round Core Information');

        const nameInput = new TextInputBuilder()
            .setCustomId(CoreInformationAction.INPUT_IDS.NAME)
            .setLabel('Funding Round Name')
            .setStyle(TextInputStyle.Short)
            .setValue(nameValue)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(CoreInformationAction.INPUT_IDS.DESCRIPTION)
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(descriptionValue)
            .setRequired(true);

        const budgetInput = new TextInputBuilder()
            .setCustomId(CoreInformationAction.INPUT_IDS.BUDGET)
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setValue(budgetValue)
            .setRequired(true);

        const stakingLedgerEpochInput = new TextInputBuilder()
            .setCustomId(CoreInformationAction.INPUT_IDS.STAKING_LEDGER_EPOCH)
            .setLabel('Staking Ledger Epoch Number')
            .setStyle(TextInputStyle.Short)
            .setValue(stakingLedgerEpochValue)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerEpochInput)
        );

        await interaction.showModal(modal);
    }

    private async handleSubmitForm(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrError(interaction.interaction);

        const topicId = ArgumentOracle.getNamedArgument(interaction, CoreInformationAction.INPUT_IDS.TOPIC);

        const name = modalInteraction.fields.getTextInputValue(CoreInformationAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(CoreInformationAction.INPUT_IDS.DESCRIPTION);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(CoreInformationAction.INPUT_IDS.BUDGET));
        const stakingLedgerEpoch = parseInt(modalInteraction.fields.getTextInputValue(CoreInformationAction.INPUT_IDS.STAKING_LEDGER_EPOCH));

        const fundingRoung: FundingRound = await FundingRoundLogic.newFundingRoundFromCoreInfo(name, description, parseInt(topicId), budget, stakingLedgerEpoch);
        interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoung.id.toString());

        await (this.screen as ManageFundingRoundsScreen).createFundingRoundAction.handleOperation(
            interaction,
            CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS
        );
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CoreInformationAction.OPERATIONS.SHOW_FORM))
            .setLabel('Edit Core Information')
            .setStyle(ButtonStyle.Primary);
    }
}


export class SetPhaseAction extends Action {
    public static readonly ID = 'setPhase';

    public static readonly OPERATIONS = {
        SHOW_FORM: 'showForm',
        SUBMIT_FORM: 'submitForm',
    };

    private static readonly INPUT_IDS = {
        START_DATE: 'stDt',
        END_DATE: 'edDt',
        VOTING_OPEN_UNTIL: 'vou',
        STAKING_LEDGER_EPOCH: 'stLdEp',
    };

    public static readonly ARGUMENTS = {
        PHASE: 'phase',
    }

    public static PHASE_OPTIONS = {
        CONSIDERATION: FundingRoundMI.PHASES.CONSIDERATION,
        DELIBERATION: FundingRoundMI.PHASES.DELIBERATION,
        VOTING: FundingRoundMI.PHASES.VOTING,
        ROUND: FundingRoundMI.PHASES.ROUND,
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SetPhaseAction.OPERATIONS.SHOW_FORM:
                await this.handleShowForm(interaction);
                break;
            case SetPhaseAction.OPERATIONS.SUBMIT_FORM:
                await this.handleSubmitForm(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowForm(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const phase = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);
        const parsedPhase = FundingRoundMI.toFundingRoundPhaseFromString(phase);

        let startValue = '';
        let endValue = '';
        let stakingLedgerEpochValue = '';
        let votingOpenUntilValue = '';
        if (phase === FundingRoundMI.PHASES.ROUND) {
            const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(parseInt(fundingRoundId));
            startValue = this.formatDate(fundingRound.startAt);
            endValue = this.formatDate(fundingRound.endAt);
            votingOpenUntilValue = this.formatDate(fundingRound.votingOpenUntil);
            stakingLedgerEpochValue = fundingRound.stakingLedgerEpoch.toString();
        } else {
            const phaseData = await FundingRoundLogic.getFundingRoundPhase(parseInt(fundingRoundId), parsedPhase);
            if (phaseData) {
                startValue = this.formatDate(phaseData.startAt);
                endValue = this.formatDate(phaseData.endAt);
                stakingLedgerEpochValue = phaseData.stakingLedgerEpoch.toString();
            }
        }



        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetPhaseAction.OPERATIONS.SUBMIT_FORM, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId, ArgumentOracle.COMMON_ARGS.PHASE, phase))
            .setTitle(`Set ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`);

        const startDateInput = new TextInputBuilder()
            .setCustomId(SetPhaseAction.INPUT_IDS.START_DATE)
            .setLabel('Start Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(startValue)
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId(SetPhaseAction.INPUT_IDS.END_DATE)
            .setLabel('End Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(endValue)
            .setRequired(true);


        const stakingLedgerEpochInput = new TextInputBuilder()
            .setCustomId(SetPhaseAction.INPUT_IDS.STAKING_LEDGER_EPOCH)
            .setLabel('Staking Ledger Epoch For Voting')
            .setStyle(TextInputStyle.Short)
            .setValue(stakingLedgerEpochValue)
            .setRequired(true);


        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerEpochInput),
        );

        if (phase === FundingRoundMI.PHASES.ROUND) {
            const votingOpenUntilInput = new TextInputBuilder()
                .setCustomId(SetPhaseAction.INPUT_IDS.VOTING_OPEN_UNTIL)
                .setLabel('Voting Open Until (YYYY-MM-DD HH:MM)')
                .setStyle(TextInputStyle.Short)
                .setValue(votingOpenUntilValue)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(votingOpenUntilInput)
            );
        }

        await interaction.showModal(modal);
    }

    private async handleSubmitForm(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrError(interaction.interaction);

        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const phase = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);

        const startDate = InputDate.toDate(modalInteraction.fields.getTextInputValue(SetPhaseAction.INPUT_IDS.START_DATE));
        const endDate = InputDate.toDate(modalInteraction.fields.getTextInputValue(SetPhaseAction.INPUT_IDS.END_DATE));
        const stakingLedgerEpoch = parseInt(modalInteraction.fields.getTextInputValue(SetPhaseAction.INPUT_IDS.STAKING_LEDGER_EPOCH));


        if (isNaN(stakingLedgerEpoch)) {
            await DiscordStatus.Error.error(interaction, 'Staking Ledger Epoch must be a number');
            return;
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            await DiscordStatus.Error.error(interaction, 'Invalid date format. Please use YYYY-MM-DD HH:MM');
            return;
        }

        const parsedPhase = FundingRoundMI.toFundingRoundPhaseFromString(phase);

        if (parsedPhase == FundingRoundMI.PHASES.ROUND) {
            // 1. Handle Funding Round core dates
            const votingOpenUntil = InputDate.toDate(modalInteraction.fields.getTextInputValue(SetPhaseAction.INPUT_IDS.VOTING_OPEN_UNTIL));
            await FundingRoundLogic.updateFundingRoundVoteData(parseInt(fundingRoundId), startDate, endDate, votingOpenUntil, stakingLedgerEpoch);
        } else {
            // 2. Handle phase dates
            const fundingRound: FundingRound = await FundingRoundLogic.updateFundingRoundPhase(parseInt(fundingRoundId), parsedPhase, stakingLedgerEpoch, startDate, endDate);
            interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRound.id.toString());
        }
        try {
            interaction.Context.set(CreateOrEditFundingRoundAction.BOOLEANS.ARGUMENTS.ONLY_SHOW_PHASES, CreateOrEditFundingRoundAction.BOOLEANS.TRUE_VALUE);
            await (this.screen as ManageFundingRoundsScreen).createFundingRoundAction.handleOperation(
                interaction,
                CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS
            );

            await DiscordStatus.Success.success(interaction, `Phase data updated successfully`);

        } catch (error) {
            throw error;
        }
    }

    private formatDate(date: Date): string {
        if (!date) {
            return '';
        }
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(phase: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SetPhaseAction.OPERATIONS.SHOW_FORM, ArgumentOracle.COMMON_ARGS.PHASE, phase))
            .setLabel(`Set ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`)
            .setStyle(ButtonStyle.Primary);
    }
}

export class SelectForumChannelAction extends PaginationComponent {
    public static readonly ID = 'selectForumChannel';

    public static readonly OPERATIONS = {
        SHOW_CHANNELS: 'showChannels',
        SELECT_CHANNEL: 'selectChannel',
    };

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const forumChannels = await this.getGuildForumChannels(interaction);
        return Math.ceil(forumChannels.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<ForumChannel[]> {
        const forumChannels = await this.getGuildForumChannels(interaction);
        return forumChannels.slice(page * 25, (page + 1) * 25);
    }

    private async getGuildForumChannels(interaction: TrackedInteraction): Promise<ForumChannel[]> {
        const guild = interaction.interaction.guild;
        if (!guild) {
            throw new EndUserError('This command can only be used in a server');
        }
        return Array.from(guild.channels.cache.filter(channel => channel.type === ChannelType.GuildForum).values()) as ForumChannel[];
    }

    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const forumChannels = await this.getItemsForPage(interaction, currentPage);
        const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectForumChannelAction.OPERATIONS.SELECT_CHANNEL, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId))
            .setPlaceholder('Select a Forum Channel')
            .addOptions(forumChannels.map(channel => ({
                label: channel.name,
                value: channel.id,
                description: `ID: ${channel.id}`
            })));

        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SelectForumChannelAction.OPERATIONS.SHOW_CHANNELS:
            case PaginationComponent.PAGINATION_ARG:
                await this.handlePagination(interaction);
                break;
            case SelectForumChannelAction.OPERATIONS.SELECT_CHANNEL:
                await this.handleSelectChannel(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleSelectChannel(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrError(interaction.interaction);
        const forumChannelId = interactionWithValues.values[0];

        const fundingRoundId: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);

        try {
            const fundingRound: FundingRound = await FundingRoundLogic.updateFundingRound(parseInt(fundingRoundId), { forumChannelId });
            interaction.Context.set(ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRound.id.toString());

            await (this.screen as ManageFundingRoundsScreen).createFundingRoundAction.handleOperation(
                interaction,
                CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS
            );
            await DiscordStatus.Success.success(interaction, 'Forum channel selected successfully');
        } catch (error) {
            await DiscordStatus.Error.handleError(interaction, error);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectForumChannelAction.OPERATIONS.SHOW_CHANNELS))
            .setLabel('Select Forum Channel')
            .setStyle(ButtonStyle.Primary);
    }
}



export class ModifyFundingRoundAction extends Action {
    public static readonly ID = 'modifyFundingRound';

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
    };




    constructor(screen: Screen, actionId: string) {
        super(screen, actionId);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case ModifyFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        await (this.screen as ManageFundingRoundsScreen).crudFRPaginatorAction.handlePagination(interaction);
    }


    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, ModifyFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS))
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
        await (this.screen as ManageFundingRoundsScreen).committeeFRPaginator.handlePagination(interaction);
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        let fundingRoundId: string  = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0);
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

    public static readonly OPERATIONS = {
        SHOW_FUNDING_ROUNDS: 'showFundingRounds',
        CONFIRM_APPROVAL: 'confirmApproval',
        EXECUTE_APPROVAL: 'executeApproval',
        EXECUTE_REJECTION: 'executeRejection',
        SELECT_FUNDING_ROUND: 'selFR',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case ApproveFundingRoundAction.OPERATIONS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case ApproveFundingRoundAction.OPERATIONS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
                break
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
        await (this.screen as ManageFundingRoundsScreen).approveRejectFRPaginator.handlePagination(interaction);
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        await this.handleConfirmApproval(interaction);
    }

    private async handleConfirmApproval(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0));

        const fundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundId);

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
        await (this.screen as ManageFundingRoundsScreen).committeeDeleteFRPaginator.handlePagination(interaction);
    }
    
    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0);
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
            case PaginationComponent.PAGINATION_ARG:
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

        const customId: string = CustomIDOracle.addArgumentsToAction((this.screen as ManageFundingRoundsScreen).createFundingRoundAction, CreateOrEditFundingRoundAction.OPERATIONS.SHOW_PROGRESS);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(customId)
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

        await interaction.update({ embeds: [embed], components, ephemeral: true });
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

        console.log("Hellooooooo");
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

        const forumChannelID = fundingRound.forumChannelId ? fundingRound.forumChannelId.toString() : '❌ Not Set';

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
                { name: 'Topic Name', value: topic.name, inline: true },
                { name: 'Topic ID', value: topic.id.toString(), inline: true },
                { name: 'Proposal Forum Channel ID', value: forumChannelID, inline: true },
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
        FORUM_CHANNEL_ID: 'fChId',
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

        const forumChannelId = new TextInputBuilder()
            .setCustomId(EditFundingRoundInformationAction.INPUT_IDS.FORUM_CHANNEL_ID)
            .setLabel('Forum Channel ID')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.forumChannelId ? fundingRound.forumChannelId.toString() : '')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerEpochInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(forumChannelId),
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
        const forumChannelId = parseInt(modalInteraction.fields.getTextInputValue(EditFundingRoundInformationAction.INPUT_IDS.FORUM_CHANNEL_ID));

        if (isNaN(budget) || isNaN(stakingLedgerEpoch) || isNaN(forumChannelId)) {
            throw new EndUserError('Invalid budget, staking ledger epoch or forum channel ID.');
        }

        try {
            const updatedFundingRound: FundingRound | null = await FundingRoundLogic.updateFundingRound(fundingRoundId, {
                name,
                description,
                budget,
                stakingLedgerEpoch,
                forumChannelId: forumChannelId.toString(),
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
                    { name: 'Staking Ledger Epoch', value: updatedFundingRound.stakingLedgerEpoch.toString(), inline: true },
                    { name: 'Forum Channel ID', value: updatedFundingRound.forumChannelId.toString(), inline: true }
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
        STAKING_LEDGER_EPOCH: 'stLdEp',
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

        embed.addFields(
            { name: 'Staking Ledger Epoch', value: fundingRound.stakingLedgerEpoch.toString(), inline: false },
        )

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

        const parsedPhase = FundingRoundMI.toFundingRoundPhaseFromString(phase);

        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            throw new EndUserError('Funding round not found.');
        }

        let startDate, endDate;
        if (phase === EditFundingRoundPhasesAction.PHASE_NAMES.ROUND) {
            startDate = fundingRound.startAt;
            endDate = fundingRound.endAt;
        } else {
            const phaseData = await FundingRoundLogic.getFundingRoundPhase(fundingRoundId, parsedPhase);
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

        const stakingLedgerEpochInput = new TextInputBuilder()
            .setCustomId(EditFundingRoundPhasesAction.INPUT_IDS.STAKING_LEDGER_EPOCH)
            .setLabel('Staking Ledger Epoch For Vote Counting')
            .setStyle(TextInputStyle.Short)
            .setValue(fundingRound.stakingLedgerEpoch ? fundingRound.stakingLedgerEpoch.toString() : '')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stakingLedgerEpochInput),
        );

        await interaction.showModal(modal);
    }

    private async handleSubmitPhaseEdit(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            throw new EndUserError('Invalid interaction type.');
        }

        const fundingRoundId: number = parseInt(ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID));
        const phase: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE);

        const startDate = InputDate.toDate(modalInteraction.fields.getTextInputValue(EditFundingRoundPhasesAction.INPUT_IDS.START_DATE));
        const endDate = InputDate.toDate(modalInteraction.fields.getTextInputValue(EditFundingRoundPhasesAction.INPUT_IDS.END_DATE));
        const stakingLedgerEpochNum: number = parseInt(modalInteraction.fields.getTextInputValue(EditFundingRoundPhasesAction.INPUT_IDS.STAKING_LEDGER_EPOCH));

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new EndUserError('Invalid date format. Please use YYYY-MM-DD HH:MM.');
        }

        if (isNaN(stakingLedgerEpochNum)) {
            throw new EndUserError('Invalid staking ledger epoch number.');
        }

        if (startDate >= endDate) {
            throw new EndUserError('Start date must be before end date.');
        }

        const stringPhase: FundingRoundMIPhaseValue = FundingRoundMI.toFundingRoundPhaseFromString(phase);

        try {
            if (phase === EditFundingRoundPhasesAction.PHASE_NAMES.ROUND) {
                await FundingRoundLogic.updateFundingRound(fundingRoundId, { startAt: startDate, endAt: endDate, stakingLedgerEpoch: stakingLedgerEpochNum });
            } else {
                await FundingRoundLogic.setFundingRoundPhase(fundingRoundId, stringPhase, stakingLedgerEpochNum, startDate, endDate);
            }

            const updatedFundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundId);
            const updatedPhases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Funding Round Phase Updated')
                .setDescription(`The ${phase} phase for "${updatedFundingRound?.name}" has been successfully updated.`)
                .addFields(
                    { name: 'Funding Round Duration', value: `Start: ${updatedFundingRound?.startAt?.toISOString() || 'Not set'}\nEnd: ${updatedFundingRound?.endAt?.toISOString() || 'Not set'}`, inline: false },
                    { name: 'Staking Ledger Epoch', value: updatedFundingRound?.stakingLedgerEpoch.toString(), inline: false }
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