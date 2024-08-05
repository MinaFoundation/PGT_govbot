import { Screen, Action, TrackedInteraction, RenderArgs, Dashboard } from '../../../core/BaseClasses';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { FundingRoundLogic } from '../../admin/screens/FundingRoundLogic';
import { OCVLinkGenerator } from '../../../utils/OCVLinkGenerator';
import { InteractionProperties } from '../../../core/Interaction';
import logger from '../../../logging';
import { DiscordStatus } from '../../DiscordStatus';
import { FundingRoundPhase } from '../../../types';

export class ForumProposalScreen extends Screen {
    public static readonly ID = 'forumProposal';
    protected permissions = []; // No specific permissions required
    public readonly forumVoteAction: ForumVoteAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.forumVoteAction = new ForumVoteAction(this, ForumVoteAction.ID);
    }

    protected allSubScreens(): Screen[] {
        return [];
    }

    protected allActions(): Action[] {
        return [this.forumVoteAction];
    }

    protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
        const proposalId = parseInt(interaction.Context.get('proposalId') || '');
        const fundingRoundId = parseInt(interaction.Context.get('fundingRoundId') || '');

        if (!proposalId || !fundingRoundId) {
            return {
                content: 'Invalid proposal or funding round ID.',
                ephemeral: true
            };
        }

        const { ProposalLogic } = await import('../../../logic/ProposalLogic');
        const proposal = await ProposalLogic.getProposalById(proposalId);
        const fundingRound = await FundingRoundLogic.getFundingRoundById(fundingRoundId);

        if (!proposal || !fundingRound) {
            return {
                content: 'Proposal or Funding Round not found.',
                ephemeral: true
            };
        }

        const phase: FundingRoundPhase | null = await FundingRoundLogic.getCurrentPhase(fundingRoundId);

        if (!phase) {
            return DiscordStatus.Error.errorData('No active phase found for this funding round.');
        }

        const phaseStr: string = phase.toString();

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Vote on Project: ${proposal.name}`)
            .setDescription(this.getPhaseDescription(phaseStr))
            .addFields(
                { name: 'Budget', value: proposal.budget.toString(), inline: true },
                { name: 'Status', value: proposal.status, inline: true },
                { name: 'URI', value: proposal.uri, inline: true },
                { name: 'Proposer Discord ID', value: proposal.proposerDuid, inline: true }
            );

        const voteButton = new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this.forumVoteAction, 'vote', 'proposalId', proposalId.toString(), 'fundingRoundId', fundingRoundId.toString(), 'phase', phaseStr))
            .setLabel('Vote On This Proposal')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton);

        return {
            embeds: [embed],
            components: [row],
            ephemeral: false
        };
    }

    private getPhaseDescription(phase: string): string {
        switch (phase) {
            case 'consideration':
                return `Voting Stage: 1️⃣/3️⃣\nCurrent Phase: Consideration Next Phase: Deliberation\n\nHere, you vote on the project's approval or rejection for the deliberation phase.`;
            case 'deliberation':
                return `Voting Stage: 2️⃣/3️⃣\nCurrent Phase: Deliberation Previous Phase: Consideration Next Phase: Funding\n\nIn this phase, you can submit your reasoning for why you believe the project should be funded or not.`;
            case 'funding':
                return `Voting Stage: 3️⃣/3️⃣\nCurrent Phase: Funding Previous Phase: Deliberation\n\n⚠️ This is the final voting stage. The votes in this stage decide which projects will be funded.`;
            default:
                return 'This project is not currently in an active voting phase.';
        }
    }
}

export class ForumVoteAction extends Action {
    public static readonly ID = 'forumVote';


    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case 'vote':
                await this.handleVote(interaction);
                break;
            case 'submitReasoning':
                await this.handleSubmitReasoning(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleVote(interaction: TrackedInteraction): Promise<void> {
        const projectId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'proposalId') || '');
        const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId') || '');
        const phase = CustomIDOracle.getNamedArgument(interaction.customId, 'phase') || '';

        if (!projectId || !fundingRoundId || !phase) {
            await interaction.respond({ content: 'Invalid project, funding round, or phase.', ephemeral: true });
            return;
        }

        if (phase === 'deliberation') {
            await this.showReasoningModal(interaction, projectId, fundingRoundId);
        } else {
            const voteLink = OCVLinkGenerator.generateProjectVoteLink(projectId, phase);
            await interaction.respond({ content: `Please use this link to vote on-chain: ${voteLink}`, ephemeral: true });
        }
    }

    private async showReasoningModal(interaction: TrackedInteraction, projectId: number, fundingRoundId: number): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'submitReasoning', 'proposalId', projectId.toString(), 'fundingRoundId', fundingRoundId.toString()))
            .setTitle('Submit Reasoning');

        const reasoningInput = new TextInputBuilder()
            .setCustomId('reasoning')
            .setLabel('Why should this project be funded?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasoningInput);
        modal.addComponents(actionRow);

        const modalInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Failed to show modal. Please try again.', ephemeral: true });
            return;
        }

        await modalInteraction.showModal(modal);
    }

    private async handleSubmitReasoning(interaction: TrackedInteraction): Promise<void> {
        const modalInteraction = InteractionProperties.toModalSubmitInteractionOrUndefined(interaction.interaction);
        if (!modalInteraction) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const projectId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'proposalId') || '');
        const fundingRoundId = parseInt(CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId') || '');
        const reasoning = modalInteraction.fields.getTextInputValue('reasoning');

        if (!projectId || !fundingRoundId || !reasoning) {
            await interaction.respond({ content: 'Invalid project, funding round, or reasoning.', ephemeral: true });
            return;
        }

        try {

            const { VoteLogic } = await import('../../../logic/VoteLogic');
            await VoteLogic.submitDeliberationReasoning(interaction.interaction.user.id, projectId, fundingRoundId, reasoning);

            const embed = new EmbedBuilder()
                .setColor('#28a745')
                .setTitle('Reasoning Submitted Successfully')
                .setDescription('Your reasoning has been recorded and will be submitted to the GPTSummarizer bot for analysis.')
                .addFields(
                    { name: 'Warning', value: 'Your submitted data will be stored for internal records and may be analyzed by our or third-party systems.' }
                );

            await interaction.respond({ embeds: [embed], ephemeral: true });
        } catch (error: unknown) {
            logger.error('Error submitting reasoning');
            await DiscordStatus.Error.handleError(interaction, error, 'Failed to submit reasoning');
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'vote'))
            .setLabel('Vote')
            .setStyle(ButtonStyle.Primary);
    }
}