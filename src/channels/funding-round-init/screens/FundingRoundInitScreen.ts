import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, MessageCreateOptions, ModalBuilder, StringSelectMenuBuilder, TextChannel, TextInputBuilder, TextInputStyle } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { ZkIgniteFacilitatorPermission } from '../permissions/ZkIgniteFacilitatorPermission';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { FundingRoundLogic } from '../../admin/screens/FundingRoundLogic';
import { FundingRound, Topic } from '../../../models';
import { InteractionProperties } from '../../../core/Interaction';
import { IHomeScreen } from '../../../types/common';


const FUNDING_ROUND_ID_ARG: string = "fid";
const PHASE_ARG: string = "ph";

export class FundingRoundInitScreen extends Screen implements IHomeScreen {
    public static readonly ID = 'fundingRoundInit';

    protected permissions: Permission[] = [new ZkIgniteFacilitatorPermission()];

    public readonly createDraftFundingRoundAction: CreateDraftFundingRoundAction;
    public readonly voteFundingRoundAction: VoteFundingRoundAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.createDraftFundingRoundAction = new CreateDraftFundingRoundAction(this, CreateDraftFundingRoundAction.ID);
        this.voteFundingRoundAction = new VoteFundingRoundAction(this, VoteFundingRoundAction.ID);
    }
    public async renderToTextChannel(channel: TextChannel): Promise<void> {
        const content: MessageCreateOptions = await this.getResponse();
        await channel.send(content);

    }

    protected allSubScreens(): Screen[] {
        return [];
    }

    protected allActions(): Action[] {
        return [
            this.createDraftFundingRoundAction,
            this.voteFundingRoundAction,
        ];
    }

    protected async getResponse(interaction: TrackedInteraction | undefined = undefined, args?: RenderArgs): Promise<any> {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('💰 Funding Round Initiation')
            .setDescription('Here, you can ✨create new funding rounds and 🗳️vote on existing ones.');

        const createButton = this.createDraftFundingRoundAction.getComponent();
        const voteButton = this.voteFundingRoundAction.getComponent();

        const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(createButton, voteButton);

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

export class CreateDraftFundingRoundAction extends Action {
    public static readonly ID = 'createDraftFundingRound';

    private static readonly OPERATIONS = {
        SUBMIT_CREATE_FORM: 'submitCreateForm',
        SHOW_SET_PHASE_DATES: 'sSpD',
        SUBMIT_PHASE_DATES: 'submitPhaseDates',
        SHOW_TOPIC_SELECT: 'showTopicSelect',
        SUBMIT_TOPIC_SELECT: 'submitTopicSelect',
    };

    private static readonly INPUT_IDS = {
        TOPIC: 'topic',
        NAME: 'name',
        DESCRIPTION: 'description',
        BUDGET: 'budget',
        VOTING_ADDRESS: 'votingAddress',
        VOTING_OPEN_UNTIL: 'votingOpenUntil',
        START_DATE: 'startDate',
        END_DATE: 'endDate',
        ROUND_START_DATE: 'roundStartDate',
        ROUND_END_DATE: 'roundEndDate',
    };

    private static readonly PHASE_NAMES = {
        consideration: 'consideration',
        deliberation: 'deliberation',
        voting: 'voting',
        round: 'round',
    };

    private static readonly NON_ROUND_PHASE_NAMES = {
        consideration: 'consideration',
        deliberation: 'deliberation',
        voting: 'voting',
    };


    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case CreateDraftFundingRoundAction.OPERATIONS.SHOW_TOPIC_SELECT:
                await this.handleShowTopicSelect(interaction);
                break;
            case CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_TOPIC_SELECT:
                await this.handleSubmitTopicSelect(interaction);
                break;
            case CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_CREATE_FORM:
                await this.handleSubmitCreateForm(interaction);
                break;
            case CreateDraftFundingRoundAction.OPERATIONS.SHOW_SET_PHASE_DATES:
                await this.handleShowSetPhaseDates(interaction);
                break;
            case CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_PHASE_DATES:
                await this.handleSubmitPhaseDates(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowTopicSelect(interaction: TrackedInteraction): Promise<void> {
        const topics = await Topic.findAll({ order: [['name', 'ASC']] });

        const topicSelect = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_TOPIC_SELECT))
            .setPlaceholder('Select Parent Topic For Funding Round')
            .addOptions(topics.slice(0, 25).map(topic => ({
                label: topic.name,
                value: topic.id.toString(),
                description: topic.description.substring(0, 100),
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(topicSelect);

        await interaction.respond({ components: [row], ephemeral: true });
    }

    private async handleSubmitTopicSelect(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const topicId = interactionWithValues.values[0];
        await this.handleShowCreateForm(interaction, topicId);
    }

    private async handleShowCreateForm(interaction: TrackedInteraction, topicId: string): Promise<void> {
        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_CREATE_FORM, 'topicId', topicId))
            .setTitle('✨ Create New Funding Round');

        const nameInput = new TextInputBuilder()
            .setCustomId(CreateDraftFundingRoundAction.INPUT_IDS.NAME)
            .setLabel('Funding Round Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(CreateDraftFundingRoundAction.INPUT_IDS.DESCRIPTION)
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const budgetInput = new TextInputBuilder()
            .setCustomId(CreateDraftFundingRoundAction.INPUT_IDS.BUDGET)
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const votingAddressInput = new TextInputBuilder()
            .setCustomId(CreateDraftFundingRoundAction.INPUT_IDS.VOTING_ADDRESS)
            .setLabel('Voting Address')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const votingOpenUntilInput = new TextInputBuilder()
            .setCustomId(CreateDraftFundingRoundAction.INPUT_IDS.VOTING_OPEN_UNTIL)
            .setLabel('Voting Open Until (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(votingAddressInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(votingOpenUntilInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitCreateForm(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        let topicId: number;
        try {
            topicId = parseInt(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.TOPIC));
        } catch (error) {
            const topicIdFromCustomId: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
            if (!topicIdFromCustomId) {
                await interaction.respond({ content: 'Topic ID not provided neither in customId, nor in context', ephemeral: true });
                throw new Error('Topic ID not provided neither in customId, nor in context');
            } else {
                topicId = parseInt(topicIdFromCustomId);
            }

        }

        const name = modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.NAME);
        const description = modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.DESCRIPTION);
        const budget = parseFloat(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.BUDGET));
        const votingAddress = modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.VOTING_ADDRESS);
        const votingOpenUntil = new Date(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.VOTING_OPEN_UNTIL));

        if (isNaN(topicId) || isNaN(budget) || isNaN(votingOpenUntil.getTime())) {
            await interaction.respond({ content: 'Invalid input. Please check your entries and try again.', ephemeral: true });
            return;
        }

        try {
            const fundingRound = await FundingRoundLogic.createDraftFundingRound(topicId, name, description, budget, votingAddress, votingOpenUntil);
            await this.showSetPhaseDates(interaction, fundingRound.id);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error creating funding round: ${errorMessage}`, ephemeral: true });
            throw error;
        }
    }

    private async showSetPhaseDates(interaction: TrackedInteraction, fundingRoundId: number): Promise<void> {
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            await interaction.respond({ content: 'Funding round not found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Set Phase Dates for ${fundingRound.name}`)
            .setDescription('Please set the dates for each phase of the funding round.')
            .addFields(
                { name: 'Description', value: fundingRound.description },
                { name: 'Budget', value: fundingRound.budget.toString() },
                { name: 'Voting Address', value: fundingRound.votingAddress },
                { name: 'Voting Open Until', value: fundingRound.votingOpenUntil.toISOString() },
                { name: 'Start Date', value: fundingRound.startAt ? fundingRound.startAt.toISOString() : '❌ Not Set' },
                { name: 'End Date', value: fundingRound.startAt ? fundingRound.endAt.toISOString() : '❌ Not Set' },
            );

        const phases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);
        const buttons: ButtonBuilder[] = [];

        if (!fundingRound.startAt || !fundingRound.endAt) {
            const setRoundDurationButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SHOW_SET_PHASE_DATES, FUNDING_ROUND_ID_ARG, fundingRoundId.toString(), PHASE_ARG, 'round'))
                .setLabel('Set Round Duration')
                .setStyle(ButtonStyle.Primary);

            buttons.push(setRoundDurationButton);
        } else {
            embed.addFields({ name: 'Round Duration', value: `Start: ${fundingRound.startAt.toISOString()}\nEnd: ${fundingRound.endAt.toISOString()}` });
        }

        for (let phaseName of Object.values(CreateDraftFundingRoundAction.NON_ROUND_PHASE_NAMES)) {
            phaseName = phaseName.toLowerCase();
            const phase = phases.find(p => p.phase === phaseName);
            if (!phase) {
                const button = new ButtonBuilder()
                    .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SHOW_SET_PHASE_DATES, FUNDING_ROUND_ID_ARG, fundingRoundId.toString(), PHASE_ARG, phaseName))
                    .setLabel(`Set ${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase`)
                    .setStyle(ButtonStyle.Primary);
                buttons.push(button);
            } else {
                embed.addFields({ name: `${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase`, value: `Start: ${phase.startDate.toISOString()}\nEnd: ${phase.endDate.toISOString()}` });
            }
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

        await interaction.update({ embeds: [embed], components: buttons.length > 0 ? [row] : [], ephemeral: true });
    }

    private async handleShowSetPhaseDates(interaction: TrackedInteraction): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID_ARG);
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, PHASE_ARG)?.toLowerCase() as keyof typeof CreateDraftFundingRoundAction.PHASE_NAMES;

        if (!fundingRoundId || !phase) {
            await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
            return;
        }

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'This interaction does not support modals.', ephemeral: true });
            return;
        }

        const title: string = phase == CreateDraftFundingRoundAction.PHASE_NAMES.round ? "Set Round Duration" : `Set ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase Dates`
        const startDateCustomId: string = phase == CreateDraftFundingRoundAction.PHASE_NAMES.round ? CreateDraftFundingRoundAction.INPUT_IDS.ROUND_START_DATE : CreateDraftFundingRoundAction.INPUT_IDS.START_DATE;
        const endDateCustomId: string = phase == CreateDraftFundingRoundAction.PHASE_NAMES.round ? CreateDraftFundingRoundAction.INPUT_IDS.ROUND_END_DATE : CreateDraftFundingRoundAction.INPUT_IDS.END_DATE;

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SUBMIT_PHASE_DATES, FUNDING_ROUND_ID_ARG, fundingRoundId, PHASE_ARG, phase))
            .setTitle(title);

        const startDateInput = new TextInputBuilder()
            .setCustomId(startDateCustomId)
            .setLabel('Start Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId(endDateCustomId)
            .setLabel('End Date (YYYY-MM-DD HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startDateInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endDateInput)
        );

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitPhaseDates(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID_ARG);
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, PHASE_ARG)?.toLowerCase() as keyof typeof CreateDraftFundingRoundAction.PHASE_NAMES;

        if (!fundingRoundId || !phase) {
            await interaction.respond({ content: 'Invalid funding round ID or phase.', ephemeral: true });
            return;
        }

        let startDate: Date;
        let endDate: Date;
        if (phase == CreateDraftFundingRoundAction.PHASE_NAMES.round) {
            startDate = new Date(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.ROUND_START_DATE));
            endDate = new Date(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.ROUND_END_DATE));
        } else {
            startDate = new Date(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.START_DATE));
            endDate = new Date(modalInteraction.fields.getTextInputValue(CreateDraftFundingRoundAction.INPUT_IDS.END_DATE));
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            await interaction.respond({ content: 'Invalid date format. Please use YYYY-MM-DD HH:MM.', ephemeral: true });
            return;
        }

        if (startDate >= endDate) {
            await interaction.respond({ content: 'Start date must be before end date.', ephemeral: true });
            return;
        }

        const phaseMapping = {
            'consideration': 'consideration',
            'deliberation': 'deliberation',
            'voting': 'voting',
            'round': 'round',
        } as const;

        const mappedPhase = phaseMapping[phase];

        if (!mappedPhase) {
            await interaction.respond({ content: 'Invalid phase.', ephemeral: true });
            return;
        }

        try {
            await FundingRoundLogic.setFundingRoundPhase(parseInt(fundingRoundId), mappedPhase, startDate, endDate);
            await this.showSetPhaseDates(interaction, parseInt(fundingRoundId));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error setting phase dates: ${errorMessage}`, ephemeral: true });
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, CreateDraftFundingRoundAction.OPERATIONS.SHOW_TOPIC_SELECT))
            .setLabel('✨ Create New Funding Round')
            .setStyle(ButtonStyle.Primary);
    }
}

export class VoteFundingRoundAction extends PaginationComponent {
    public static readonly ID = 'voteFundingRound';

    public static readonly OPERATIONS = {
        SHOW_ELIGIBLE_ROUNDS: 'showEligibleRounds',
        SELECT_ROUND: 'selectRound',
        SHOW_APPROVE_MODAL: 'showApproveModal',
        SHOW_REJECT_MODAL: 'showRejectModal',
        SUBMIT_APPROVE: 'submitApprove',
        SUBMIT_REJECT: 'submitReject',
    };

    public static readonly INPUT_IDS = {
        REASON: 'reason',
    };

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const eligibleRounds = await FundingRoundLogic.getEligibleVotingRounds();
        return Math.ceil(eligibleRounds.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
        const eligibleRounds = await FundingRoundLogic.getEligibleVotingRounds();
        return eligibleRounds.slice(page * 25, (page + 1) * 25);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case VoteFundingRoundAction.OPERATIONS.SHOW_ELIGIBLE_ROUNDS:
                await this.handleShowEligibleRounds(interaction);
                break;
            case VoteFundingRoundAction.OPERATIONS.SELECT_ROUND:
                await this.handleSelectRound(interaction);
                break;
            case VoteFundingRoundAction.OPERATIONS.SHOW_APPROVE_MODAL:
                await this.handleShowApproveModal(interaction);
                break;
            case VoteFundingRoundAction.OPERATIONS.SHOW_REJECT_MODAL:
                await this.handleShowRejectModal(interaction);
                break;
            case VoteFundingRoundAction.OPERATIONS.SUBMIT_APPROVE:
                await this.handleSubmitApprove(interaction);
                break;
            case VoteFundingRoundAction.OPERATIONS.SUBMIT_REJECT:
                await this.handleSubmitReject(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowEligibleRounds(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const eligibleRounds = await this.getItemsForPage(interaction, currentPage);

        if (eligibleRounds.length === 0) {
            await interaction.respond({ content: 'There are no eligible funding rounds for voting at this time.', ephemeral: true });
            return;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, VoteFundingRoundAction.OPERATIONS.SELECT_ROUND))
            .setPlaceholder('🗳️ Select a Funding Round to Vote On')
            .addOptions(eligibleRounds.map(round => ({
                label: round.name,
                value: round.id.toString(),
                description: `Budget: ${round.budget}, Voting Until: ${round.votingOpenUntil.toLocaleDateString()}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [row];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.respond({ components, ephemeral: true });
    }

    private async handleSelectRound(interaction: TrackedInteraction, successMessage: string | undefined = undefined, errorMesasge: string | undefined = undefined): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);

        // Get funding round ID from custom ID or context
        let fundingRoundId: number;
        if (!interactionWithValues) {
            const fundingRoundIdFromContext: string | undefined = interaction.Context.get(FUNDING_ROUND_ID_ARG);
            if (!fundingRoundIdFromContext) {
                await interaction.respond({ content: 'fundingRoundId not provided neither in customId, nor in context', ephemeral: true });
                throw new Error('fundingRoundId not provided neither in customId, nor in context');
            } else {
                fundingRoundId = parseInt(fundingRoundIdFromContext);
            }
        } else {
            fundingRoundId = parseInt(interactionWithValues.values[0]);
        }
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!fundingRound) {
            await interaction.respond({ content: `Funding round ${fundingRoundId} not found.`, ephemeral: true });
            return;
        }

        let statusEmbed: EmbedBuilder | undefined;

        if (successMessage) {
            statusEmbed = new EmbedBuilder()
                .setColor('#28a745')
                .setDescription(successMessage);
        } else if (errorMesasge) {
            statusEmbed = new EmbedBuilder()
                .setColor('#dc3545')
                .setDescription(errorMesasge);
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Funding Round: ${fundingRound.name} (${fundingRoundId})`)
            .setDescription(fundingRound.description)
            .addFields(
                { name: 'Budget', value: fundingRound.budget.toString(), inline: true },
                { name: 'Voting Address', value: fundingRound.votingAddress, inline: true },
                { name: 'Voting Open Until', value: fundingRound.votingOpenUntil.toISOString(), inline: true },
                { name: 'Status', value: fundingRound.status, inline: true },
                { name: 'Start Date', value: fundingRound.startAt ? fundingRound.startAt.toISOString() : '❌ Not Set', inline: true },
                { name: 'End Date', value: fundingRound.endAt ? fundingRound.endAt.toISOString() : '❌ Not Set', inline: true },
            );

        const phases = await FundingRoundLogic.getFundingRoundPhases(fundingRoundId);
        phases.forEach(phase => {
            embed.addFields({ name: `${phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1)} Phase`, value: `Start: ${phase.startDate.toISOString()}\nEnd: ${phase.endDate.toISOString()}`, inline: true });
        });

        const latestVote = await FundingRoundLogic.getLatestVote(interaction.interaction.user.id, fundingRoundId);
        const canChangeVote = await FundingRoundLogic.canChangeVote(interaction.interaction.user.id, fundingRoundId);


        const row = new ActionRowBuilder<ButtonBuilder>();

        let approveButton, rejectButton, changeButton;
        if (latestVote) {

            embed.addFields({ name: 'Your Current Vote', value: latestVote.isPass ? '✅ Approved' : '❌ Rejected' });
            // User has a vote, so present option to change it.
            const label: string = !latestVote.isPass ? '✅ Change Vote & Approve' : '❌ Change Vote & Reject';
            const style = !latestVote.isPass ? ButtonStyle.Success : ButtonStyle.Danger;

            const operation: string = !latestVote.isPass ? VoteFundingRoundAction.OPERATIONS.SHOW_APPROVE_MODAL : VoteFundingRoundAction.OPERATIONS.SHOW_REJECT_MODAL;
            changeButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, operation, FUNDING_ROUND_ID_ARG, fundingRoundId.toString()))
                .setLabel(label)
                .setStyle(style);

            if (!canChangeVote) {
                changeButton.setDisabled(true);
            }
            row.addComponents(changeButton);

        } else {
            // Use has no prior votes, so present option to vote.
            approveButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, VoteFundingRoundAction.OPERATIONS.SHOW_APPROVE_MODAL, FUNDING_ROUND_ID_ARG, fundingRoundId.toString()))
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success);

            rejectButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, VoteFundingRoundAction.OPERATIONS.SHOW_REJECT_MODAL, FUNDING_ROUND_ID_ARG, fundingRoundId.toString()))
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger);

            if (!canChangeVote) {
                approveButton.setDisabled(true);
                rejectButton.setDisabled(true);
            }
            row.addComponents(approveButton, rejectButton);
        }

        await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
    }


    public allSubActions(): Action[] {
        return [];
    }

    private async handleShowApproveModal(interaction: TrackedInteraction): Promise<void> {
        await this.showVoteModal(interaction, true);
    }

    private async handleShowRejectModal(interaction: TrackedInteraction): Promise<void> {
        await this.showVoteModal(interaction, false);
    }

    private async showVoteModal(interaction: TrackedInteraction, isApprove: boolean): Promise<void> {
        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID_ARG);
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
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, isApprove ? VoteFundingRoundAction.OPERATIONS.SUBMIT_APPROVE : VoteFundingRoundAction.OPERATIONS.SUBMIT_REJECT, FUNDING_ROUND_ID_ARG, fundingRoundId))
            .setTitle(`${isApprove ? 'Approve' : 'Reject'} ${fundingRound.name} Funding Round`);

        const reasonInput = new TextInputBuilder()
            .setCustomId(VoteFundingRoundAction.INPUT_IDS.REASON)
            .setLabel('Reason for your vote')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(3)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitApprove(interaction: TrackedInteraction): Promise<void> {
        await this.handleSubmitVote(interaction, true);
    }

    private async handleSubmitReject(interaction: TrackedInteraction): Promise<void> {
        await this.handleSubmitVote(interaction, false);
    }

    private async handleSubmitVote(interaction: TrackedInteraction, isApprove: boolean): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID_ARG);
        if (!fundingRoundId) {
            await interaction.respond({ content: 'Invalid funding round ID.', ephemeral: true });
            return;
        }

        const reason = modalInteraction.fields.getTextInputValue(VoteFundingRoundAction.INPUT_IDS.REASON);

        try {
            if (isApprove) {
                await FundingRoundLogic.createApproveVote(interaction.interaction.user.id, parseInt(fundingRoundId), reason);
            } else {
                await FundingRoundLogic.createRejectVote(interaction.interaction.user.id, parseInt(fundingRoundId), reason);
            }
            const message: string = `Your ${isApprove ? '✅approval' : '❌rejection'} vote has been recorded.`
            interaction.Context.set(FUNDING_ROUND_ID_ARG, fundingRoundId);
            await this.handleSelectRound(interaction, isApprove ? message : undefined, isApprove ? undefined : message);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await interaction.respond({ content: `Error recording vote: ${errorMessage}`, ephemeral: true });
        }
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, VoteFundingRoundAction.OPERATIONS.SHOW_ELIGIBLE_ROUNDS))
            .setLabel('🗳️ Vote on Existing Funding Round')
            .setStyle(ButtonStyle.Primary);
    }

    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
        await this.handleShowEligibleRounds(interaction);
    }
}  