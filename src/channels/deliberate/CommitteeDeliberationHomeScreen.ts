// src/channels/deliberate/CommitteeDeliberationHomeScreen.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, ModalBuilder, StringSelectMenuBuilder, TextChannel, TextInputBuilder, TextInputStyle } from 'discord.js';
import { CommitteeDeliberationLogic } from '../../logic/CommitteeDeliberationLogic';
import { IHomeScreen } from '../../types/common';
import { Screen, Action, Dashboard, Permission, RenderArgs, TrackedInteraction } from '../../core/BaseClasses';
import { CustomIDOracle } from '../../CustomIDOracle';
import { InteractionProperties } from '../../core/Interaction';
import { CommitteeDeliberationVoteLog, DeliberationPhase, FundingRound, FundingRoundDeliberationCommitteeSelection, Proposal } from '../../models';
import { Op } from 'sequelize';
import { PaginationComponent } from '../../components/PaginationComponent';
import { CommitteeDeliberationVoteChoice } from '../../types';
import { EndUserError } from '../../Errors';

const FUNDING_ROUND_ID: string = 'fId';

const VOTING_OPTION_IDS = {
    APPROVE: 'ap',
    REJECT: 'rj',
    APPROVE_MODIFIED: 'am',
};

const VOTING_ARGS = {
    SHOW_UNVOTED: 'shun',
}

const SCREEN_IDS = {
    HOME: 'cdHome',
    SELECT_FUNDING_ROUND: 'selectEligibleFundingRound',
    SELECT_VOTE_TYPE: 'selectVoteType',
    SELECT_ELIGIBLE_PROJECT: 'selectEligibleProject',
    SELECT_VOTED_PROJECT: 'selectVotedProject',
    COMMITTEE_DELIBERATION_VOTE: 'committeeDeliberationVote',
};

const ACTION_IDS = {
    SELECT_FUNDING_ROUND: 'selectFundingRound',
    SELECT_VOTE_TYPE: 'selectVoteType',
    SELECT_PROJECT: 'selectProject',
    COMMITTEE_DELIBERATION_VOTE: 'committeeDeliberationVote',
};

const OPERATION_IDS = {
    SHOW_FUNDING_ROUNDS: 'showFundingRounds',
    SELECT_FUNDING_ROUND: 'selectFundingRound',
    SHOW_VOTE_TYPES: 'showVoteTypes',
    SELECT_VOTE_TYPE: 'selectVoteType',
    SHOW_PROJECTS: 'showProjects',
    SELECT_PROJECT: 'selectProject',
    SHOW_VOTE_OPTIONS: 'showVoteOptions',
    SUBMIT_VOTE: 'submitVote',
    CONFIRM_VOTE: 'confirmVote',
};

const BUTTON_IDS = {
    SELECT_FUNDING_ROUND: 'selectFundingRoundBtn',
    ADD_PROJECT_EVALUATION: 'addProjectEvaluationBtn',
    CHANGE_PROJECT_EVALUATION: 'changeProjectEvaluationBtn',
    APPROVE_PROJECT: 'approveProjectBtn',
    REJECT_PROJECT: 'rejectProjectBtn',
    UPDATE_VOTE: 'updateVoteBtn',
};

const INPUT_IDS = {
    REASON: 'reason',
    URI: 'uri',
};

export class CommitteeDeliberationHomeScreen extends Screen implements IHomeScreen {
    public static readonly ID = SCREEN_IDS.HOME;

    protected permissions: Permission[] = []; // TODO: Implement committee member permission check

    public readonly selectFundingRoundAction: SelectFundingRoundAction;
    public readonly selectVoteTypeAction: SelectVoteTypeAction;
    public readonly selectProjectAction: SelectProjectAction;
    public readonly committeeDeliberationVoteAction: CommitteeDeliberationVoteAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.selectFundingRoundAction = new SelectFundingRoundAction(this, ACTION_IDS.SELECT_FUNDING_ROUND);
        this.selectVoteTypeAction = new SelectVoteTypeAction(this, ACTION_IDS.SELECT_VOTE_TYPE);
        this.selectProjectAction = new SelectProjectAction(this, ACTION_IDS.SELECT_PROJECT);
        this.committeeDeliberationVoteAction = new CommitteeDeliberationVoteAction(this, ACTION_IDS.COMMITTEE_DELIBERATION_VOTE);
    }

    public async renderToTextChannel(channel: TextChannel): Promise<void> {
        const content = await this.getResponse();
        await channel.send(content);
    }

    protected allSubScreens(): Screen[] {
        return [];
    }

    protected allActions(): Action[] {
        return [this.selectFundingRoundAction];
    }

    protected async getResponse(interaction?: TrackedInteraction, args?: RenderArgs): Promise<any> {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Committee Proposal Deliberation')
            .setDescription('Here, the committee members can submit their evaluation votes on a Funding Round. Begin by selecting a funding round, by pressing the "Select Funding Round" button below.');

        const selectFundingRoundButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this.selectFundingRoundAction, OPERATION_IDS.SHOW_FUNDING_ROUNDS))
            .setLabel('Select Funding Round')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(selectFundingRoundButton);

        return {
            embeds: [embed],
            components: [row],
            ephemeral: true
        };
    }
}

class SelectFundingRoundAction extends Action {
    public static readonly ID = ACTION_IDS.SELECT_FUNDING_ROUND;

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case OPERATION_IDS.SHOW_FUNDING_ROUNDS:
                await this.handleShowFundingRounds(interaction);
                break;
            case OPERATION_IDS.SELECT_FUNDING_ROUND:
                await this.handleSelectFundingRound(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        const eligibleFundingRounds = await this.getEligibleFundingRounds(interaction.interaction.user.id);

        if (eligibleFundingRounds.length === 0) {
            await interaction.respond({
                content: '😊 This functionality is only available for committee members. If you believe this is an error, please contact an administrator.',
                ephemeral: true
            });
            return;
        }

        const options = eligibleFundingRounds.map(fr => ({
            label: fr.name,
            value: fr.id.toString(),
            description: `Budget: ${fr.budget}, Ends: ${fr.endAt.toLocaleDateString()}`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SELECT_FUNDING_ROUND))
            .setPlaceholder('Select a Funding Round')
            .addOptions(options);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Select A Funding Round To Deliberate On')
            .setDescription('Welcome, committee member!\n\nPlease select a Funding Round on which you would like to submit your deliberation votes in the dropdown below.');

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            throw new EndUserError('Invalid interaction type.');
        }

        const fundingRoundId = parseInt(interactionWithValues.values[0]);
        await (this.screen as CommitteeDeliberationHomeScreen).selectVoteTypeAction.handleOperation(
            interaction,
            OPERATION_IDS.SHOW_VOTE_TYPES,
            { fundingRoundId }
        );
    }

    private async getEligibleFundingRounds(userId: string): Promise<FundingRound[]> {
        const now = new Date();
        const committeeSelections = await FundingRoundDeliberationCommitteeSelection.findAll({
            where: { duid: userId }
        });

        const eligibleFundingRoundIds = committeeSelections.map(selection => selection.fundingRoundId);

        return await FundingRound.findAll({
            where: {
                id: eligibleFundingRoundIds,
                status: 'APPROVED',
                startAt: { [Op.lte]: now },
                endAt: { [Op.gt]: now },
            },
            include: [{
                model: DeliberationPhase,
                as: 'deliberationPhase',
                where: {
                    startAt: { [Op.lte]: now },
                    endAt: { [Op.gt]: now },
                },
            }],
        });
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SHOW_FUNDING_ROUNDS))
            .setLabel('Select Funding Round')
            .setStyle(ButtonStyle.Primary);
    }
}

class SelectVoteTypeAction extends Action {
    public static readonly ID = ACTION_IDS.SELECT_VOTE_TYPE;

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case OPERATION_IDS.SHOW_VOTE_TYPES:
                await this.handleShowVoteTypes(interaction, args);
                break;
            case OPERATION_IDS.SELECT_VOTE_TYPE:
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
        const unvotedProposalsCount = await CommitteeDeliberationLogic.getUnvotedProposalsCount(fundingRoundId, userId);
        const hasVotedProposals = await CommitteeDeliberationLogic.hasVotedProposals(fundingRoundId, userId);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`You're Deliberating On ${fundingRound.name}`)
            .setDescription(`Here, you can submit your evaluation votes on the projects in ${fundingRound.name}. 
                         You can add a new vote or change an existing one.
  
                         To begin, select whether you would like to cast a new vote or change an existing one.`);

        if (unvotedProposalsCount > 0) {
            embed.addFields({
                name: 'INBOX',
                value: `You still have ${unvotedProposalsCount} proposals to vote on until ${fundingRound.endAt.toLocaleString()}`,
            });
        }

        const addNewVoteButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SELECT_VOTE_TYPE, 'voteType', 'new', FUNDING_ROUND_ID, fundingRoundId.toString()))
            .setLabel(`My Assigned Votes (${unvotedProposalsCount} left)`)
            .setStyle(unvotedProposalsCount > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(unvotedProposalsCount === 0);

        const changeVoteButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SELECT_VOTE_TYPE, 'voteType', 'change', FUNDING_ROUND_ID, fundingRoundId.toString(), VOTING_ARGS.SHOW_UNVOTED, 'false'))
            .setLabel('Change Existing Vote')
            .setStyle(hasVotedProposals ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!hasVotedProposals);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(addNewVoteButton, changeVoteButton);

        await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
    }

    private async handleSelectVoteType(interaction: TrackedInteraction): Promise<void> {
        const voteType = CustomIDOracle.getNamedArgument(interaction.customId, 'voteType');
        const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID) || '');

        if (voteType === 'new') {
            await (this.screen as CommitteeDeliberationHomeScreen).selectProjectAction.handleOperation(
                interaction,
                OPERATION_IDS.SHOW_PROJECTS,
                { fundingRoundId, showUnvoted: true }
            );
        } else if (voteType === 'change') {
            await (this.screen as CommitteeDeliberationHomeScreen).selectProjectAction.handleOperation(
                interaction,
                OPERATION_IDS.SHOW_PROJECTS,
                { fundingRoundId, showUnvoted: false }
            );
        } else {
            throw new EndUserError('Invalid vote type selected.')
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
    public static readonly ID = ACTION_IDS.SELECT_PROJECT;

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID) || '');
        const showUnvoted = CustomIDOracle.getNamedArgument(interaction.customId, VOTING_ARGS.SHOW_UNVOTED) === 'true';
        const projects = await CommitteeDeliberationLogic.getEligibleProjects(fundingRoundId, interaction.interaction.user.id, showUnvoted);
        return Math.ceil(projects.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<Proposal[]> {
        const fundingRoundIdOpt: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID)

        if (!fundingRoundIdOpt) {
            throw new EndUserError('fundingRoundId not included in the customId')
            return [];
        }

        const fundingRoundId: number = parseInt(fundingRoundIdOpt);

        let showUnvoted: boolean = true;


        const showUnvotedValue: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, VOTING_ARGS.SHOW_UNVOTED);
        if (showUnvotedValue === 'true') {
            showUnvoted = true;
        } else if (showUnvotedValue === 'false') {
            showUnvoted = false;
        }

        const projects = await CommitteeDeliberationLogic.getEligibleProjects(fundingRoundId, interaction.interaction.user.id, showUnvoted);
        return projects.slice(page * 25, (page + 1) * 25);
    }

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case OPERATION_IDS.SHOW_PROJECTS:
                await this.handleShowProjects(interaction, args);
                break;
            case OPERATION_IDS.SELECT_PROJECT:
                await this.handleSelectProject(interaction);
                break;
            case 'paginate':
                await this.handlePagination(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowProjects(interaction: TrackedInteraction, args: { fundingRoundId: number, showUnvoted: boolean }): Promise<void> {
        const { fundingRoundId, showUnvoted } = args;
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const projects = await this.getItemsForPage(interaction, currentPage);

        if (projects.length === 0) {
            throw new EndUserError('There are no eligible projects to vote on at the moment.');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Select A Project To Deliberate On')
            .setDescription(`Please select a project on which you would like to submit your deliberation vote in the dropdown below. 
                         Details of the selected project will be displayed once one is selected.
                         Page ${currentPage + 1} of ${totalPages}`);

        const options = projects.map(p => ({
            label: p.name,
            value: p.id.toString(),
            description: `Budget: ${p.budget}`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SELECT_PROJECT, FUNDING_ROUND_ID, fundingRoundId.toString(), VOTING_ARGS.SHOW_UNVOTED, showUnvoted.toString()))
            .setPlaceholder('Select a Project')
            .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [row];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ embeds: [embed], components, ephemeral: true });
    }

    private async handleSelectProject(interaction: TrackedInteraction): Promise<void> {
        const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!interactionWithValues) {
            throw new EndUserError('Invalid interaction type.');
        }

        const projectId = parseInt(interactionWithValues.values[0]);
        const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID) || '');

        await (this.screen as CommitteeDeliberationHomeScreen).committeeDeliberationVoteAction.handleOperation(
            interaction,
            OPERATION_IDS.SHOW_VOTE_OPTIONS,
            { projectId, fundingRoundId }
        );
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(fundingRoundId: number, showUnvoted: boolean): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SHOW_PROJECTS, FUNDING_ROUND_ID, fundingRoundId.toString(), VOTING_ARGS.SHOW_UNVOTED, showUnvoted.toString()))
            .setLabel('Select Project')
            .setStyle(ButtonStyle.Primary);
    }
}

class CommitteeDeliberationVoteAction extends Action {
    public static readonly ID = ACTION_IDS.COMMITTEE_DELIBERATION_VOTE;

    public async handleOperation(interaction: TrackedInteraction, operationId: string, args?: any): Promise<void> {
        switch (operationId) {
            case OPERATION_IDS.SHOW_VOTE_OPTIONS:
                await this.handleShowVoteOptions(interaction, args);
                break;
            case OPERATION_IDS.SUBMIT_VOTE:
                await this.handleSubmitVote(interaction);
                break;
            case OPERATION_IDS.CONFIRM_VOTE:
                await this.handleConfirmVote(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowVoteOptions(interaction: TrackedInteraction, args: { projectId: number, fundingRoundId: number }): Promise<void> {
        const { projectId, fundingRoundId } = args;
        const project = await Proposal.findByPk(projectId);
        const fundingRound = await FundingRound.findByPk(fundingRoundId);
        const existingVote = await CommitteeDeliberationVoteLog.findOne({
            where: {
                duid: interaction.interaction.user.id,
                proposalId: projectId,
            },
            order: [['createdAt', 'DESC']],
        });

        if (!project || !fundingRound) {
            throw new EndUserError('Project or Funding Round not found.');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`You're ${existingVote ? 'Changing Your Vote' : 'Voting'} on ${project.name} in ${fundingRound.name}`)
            .setDescription(`Here, you can ${existingVote ? `change your vote (${existingVote.vote ? 'Approved' : 'Rejected'})` : 'vote'} on ${project.name}.`)
            .addFields(
                { name: 'About Funding Round', value: `ID: ${fundingRound.id}\nBudget: ${fundingRound.budget}\nStart: ${fundingRound.startAt.toLocaleString()}\nEnd: ${fundingRound.endAt.toLocaleString()}` },
                { name: 'About Project', value: `ID: ${project.id}\nName: ${project.name}\nBudget: ${project.budget}\nSubmitter: ${project.proposerDuid}\nURI: ${project.uri}` }
            );

        let isExistingVoteApproved = false;
        let isExistingVoteApprovedModified = false;
        let isExistingVoteRejected = false;

        if (existingVote) {
            embed.addFields({ name: 'Current Vote', value: existingVote.vote ? 'Approved' : 'Rejected' });
            if (existingVote.vote === CommitteeDeliberationVoteChoice.APPROVED) {
                isExistingVoteApproved = true;
            }
            if (existingVote.vote === CommitteeDeliberationVoteChoice.APPROVED_MODIFIED) {
                isExistingVoteApprovedModified = true;
            }
            if (existingVote.vote === CommitteeDeliberationVoteChoice.REJECTED) {
                isExistingVoteRejected = true;
            }
        }

        const approveButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SUBMIT_VOTE, 'projectId', projectId.toString(), FUNDING_ROUND_ID, fundingRoundId.toString(), 'vote', VOTING_OPTION_IDS.APPROVE))
            .setLabel(existingVote ? 'Change to Approve' : 'Approve Project')
            .setStyle(ButtonStyle.Success);

        const approveModifiedButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SUBMIT_VOTE, 'projectId', projectId.toString(), FUNDING_ROUND_ID, fundingRoundId.toString(), 'vote', VOTING_OPTION_IDS.APPROVE_MODIFIED))
            .setLabel(existingVote ? 'Change to Approve Modified' : 'Approve With Modifications')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.SUBMIT_VOTE, 'projectId', projectId.toString(), FUNDING_ROUND_ID, fundingRoundId.toString(), 'vote', VOTING_OPTION_IDS.REJECT))
            .setLabel(existingVote ? 'Change to Reject' : 'Reject Project')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>();

        if (!isExistingVoteApproved) {
            row.addComponents(approveButton);
        }

        if (!isExistingVoteApprovedModified) {
            row.addComponents(approveModifiedButton);
        }

        if (!isExistingVoteRejected) {
            row.addComponents(rejectButton);
        }

        await interaction.respond({ embeds: [embed], components: [row], ephemeral: true });
    }

    private async handleSubmitVote(interaction: TrackedInteraction): Promise<void> {
        const projectIdRaw: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'projectId');
        if (!projectIdRaw) {
            throw new EndUserError('projectId not included in the customId');
        }
        const projectId: number = parseInt(projectIdRaw);



        const fundingRoundIdRaw: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID);
        if (!fundingRoundIdRaw) {
            throw new EndUserError('fundingRoundId not included in the customId');
        }
        const fundingRoundId: number = parseInt(fundingRoundIdRaw);

        const voteRaw: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'vote');
        if (!voteRaw) {
            throw new EndUserError('vote not included in the customId');
        }

        const isReasonRequired: boolean = await CommitteeDeliberationLogic.hasVotedOnProject(interaction.interaction.user.id, projectId, fundingRoundId);


        let title;
        if (voteRaw === VOTING_OPTION_IDS.APPROVE) {
            title = 'Approve Project';
        } else if (voteRaw === VOTING_OPTION_IDS.REJECT) {
            title = 'Reject Project';
        } else if (voteRaw === VOTING_OPTION_IDS.APPROVE_MODIFIED) {
            title = 'Approve Project with Modifications';
        } else {
            await interaction.respond({ content: `Invalid vote option: ${voteRaw}`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, OPERATION_IDS.CONFIRM_VOTE, 'projectId', projectId.toString(), FUNDING_ROUND_ID, fundingRoundId.toString(), 'vote', voteRaw))
            .setTitle(title);

        const uriInput = new TextInputBuilder()
            .setCustomId(INPUT_IDS.URI)
            .setLabel('URL (https://forums.minaprotocol.com/...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(uriInput)
        );

        if (isReasonRequired) {
            const reasonInput = new TextInputBuilder()
                .setCustomId(INPUT_IDS.REASON)
                .setLabel('Reason for changing your vote')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
            )
        }


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

        const projectIdRaw: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'projectId');
        if (!projectIdRaw) {
            throw new EndUserError('projectId not included in the customId');
        }
        const projectId: number = parseInt(projectIdRaw);

        const fundingRoundIdRaw = CustomIDOracle.getNamedArgument(interaction.customId, FUNDING_ROUND_ID);
        if (!fundingRoundIdRaw) {
            throw new EndUserError('fundingRoundId not included in the customId');
        }
        const fundingRoundId: number = parseInt(fundingRoundIdRaw);

        const voteRaw = CustomIDOracle.getNamedArgument(interaction.customId, 'vote');
        const reason = modalInteraction.fields.getTextInputValue(INPUT_IDS.REASON);
        const uri: string | undefined = modalInteraction.fields.getTextInputValue(INPUT_IDS.URI);

        if (!uri) {
            throw new EndUserError('You must provide the link justifying your vote under https://forums.minaprotocol.com');
        }

        let description;
        let vote: CommitteeDeliberationVoteChoice;
        if (voteRaw === VOTING_OPTION_IDS.APPROVE) {
            vote = CommitteeDeliberationVoteChoice.APPROVED;
            description = 'Your vote to approve the project has been recorded. You can change it until the end of the deliberation phase.';
        } else if (voteRaw === VOTING_OPTION_IDS.REJECT) {
            description = 'Your vote to reject the project has been recorded. You can change it until the end of the deliberation phase.';
            vote = CommitteeDeliberationVoteChoice.REJECTED;
        } else if (voteRaw === VOTING_OPTION_IDS.APPROVE_MODIFIED) {
            description = 'Your vote to approve the project with modifications has been recorded. You can change it until the end of the deliberation phase.';
            vote = CommitteeDeliberationVoteChoice.APPROVED_MODIFIED;
        } else {
            await interaction.respond({ content: `Invalid vote option: ${voteRaw}`, ephemeral: true });
            return;
        }

        try {
            await CommitteeDeliberationLogic.submitVote(interaction.interaction.user.id, projectId, fundingRoundId, vote, reason, uri);

            const embed = new EmbedBuilder()
                .setColor('#28a745')
                .setTitle('Vote Submitted Successfully')
                .setDescription(description)
                .addFields(
                    { name: 'Project ID', value: projectId.toString() },
                    { name: 'Funding Round ID', value: fundingRoundId.toString() },
                    { name: 'Decision', value: vote },
                    { name: 'Reason', value: reason },
                    { name: 'URI', value: uri },
                );
            await interaction.update({ embeds: [embed], ephemeral: true });
        } catch (error) {
            throw new EndUserError(`Error submitting vote`, error);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        throw new EndUserError('CommitteeDeliberationVoteAction does not have a standalone component.');
    }
}