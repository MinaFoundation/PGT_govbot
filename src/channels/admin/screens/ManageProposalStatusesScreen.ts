// src/channels/admin/screens/ManageProposalStatusesScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionWebhook, StringSelectMenuBuilder } from 'discord.js';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { FundingRoundLogic } from './FundingRoundLogic';
import { AdminProposalLogic } from '../../../logic/AdminProposalLogic';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { DiscordStatus } from '../../DiscordStatus';
import { FundingRound, Proposal } from '../../../models';
import { AnyInteractionWithValues } from '../../../types/common';
import { InteractionProperties } from '../../../core/Interaction';
import { ProposalStatus } from '../../../types';
import { errorMonitor } from 'events';
import { EndUserError } from '../../../Errors';

export class ManageProposalStatusesScreen extends Screen {
    public static readonly ID = 'manageProposalStatuses';

    protected permissions: Permission[] = []; // TODO: Implement proper admin permissions

    public readonly selectFundingRoundAction: SelectFundingRoundAction;
    public readonly selectProposalAction: SelectProposalAction;
    public readonly updateProposalStatusAction: UpdateProposalStatusAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.selectFundingRoundAction = new SelectFundingRoundAction(this, SelectFundingRoundAction.ID);
        this.selectProposalAction = new SelectProposalAction(this, SelectProposalAction.ID);
        this.updateProposalStatusAction = new UpdateProposalStatusAction(this, UpdateProposalStatusAction.ID);
    }

    protected allSubScreens(): Screen[] {
        return [];
    }

    protected allActions(): Action[] {
        return [
            this.selectFundingRoundAction,
            this.selectProposalAction,
            this.updateProposalStatusAction,
        ];
    }

    protected async getResponse(interaction: TrackedInteraction): Promise<any> {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Manage Proposal Statuses')
            .setDescription('Select a Funding Round to manage proposal statuses:');

        const selectFundingRoundButton = this.selectFundingRoundAction.getComponent();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(selectFundingRoundButton);

        return {
            embeds: [embed],
            components: [row],
            ephemeral: true
        };
    }
}


export class SelectFundingRoundAction extends PaginationComponent {
    public static readonly ID = 'selectFundingRound';

    protected async getTotalPages(): Promise<number> {
        const fundingRounds = await FundingRoundLogic.getActiveFundingRounds();
        return Math.ceil(fundingRounds.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
        const fundingRounds = await FundingRoundLogic.getActiveFundingRounds();
        return fundingRounds.slice(page * 25, (page + 1) * 25);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case 'showFundingRounds':
                await this.handleShowFundingRounds(interaction);
                break;
            case 'selectFundingRound':
                await this.handleSelectFundingRound(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowFundingRounds(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages();
        const fundingRounds = await this.getItemsForPage(interaction, currentPage);

        if (fundingRounds.length === 0) {
            await DiscordStatus.Info.info(interaction, 'There are no active funding rounds.');
            return;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'selectFundingRound'))
            .setPlaceholder('Select a Funding Round')
            .addOptions(fundingRounds.map(fr => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Status: ${fr.status}, Budget: ${fr.budget}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
        const parsedInteraction: AnyInteractionWithValues | undefined = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);

        if (!parsedInteraction) {
            await DiscordStatus.Error.error(interaction, 'Interaction does not have values');
            throw new EndUserError('Interaction does not have values');
        }

        const fundingRoundId = parsedInteraction.values[0];

        await (this.screen as ManageProposalStatusesScreen).selectProposalAction.renderHandleShowProposals(interaction, fundingRoundId);
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

export class SelectProposalAction extends PaginationComponent {
    public static readonly ID = 'selectProposal';

    public static readonly OPERATIONS = {
        showProposals: 'showProposals',
        selectProposal: 'selectProposal'
    }

    protected async getTotalPages(interaction: TrackedInteraction, frId?:string): Promise<number> {
        let fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        
        if (frId) {
            fundingRoundId = frId.toString();
        }

        if (!fundingRoundId) {
            await DiscordStatus.Error.error(interaction, 'Funding Round ID not found in customId');
            throw new EndUserError('Funding Round ID not found in customId');
        }
        const proposals = await AdminProposalLogic.getProposalsForFundingRound(parseInt(fundingRoundId));
        return Math.ceil(proposals.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number, frId?:string): Promise<Proposal[]> {

        let fundingRoundId = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');

        if (frId) {
            fundingRoundId = frId.toString();
        }

        if (!fundingRoundId) {
            await DiscordStatus.Error.error(interaction, 'Funding Round ID not found in customId');
            throw new EndUserError('Funding Round ID not found in customId');
        }

        const proposals = await AdminProposalLogic.getProposalsForFundingRound(parseInt(fundingRoundId));
        return proposals.slice(page * 25, (page + 1) * 25);
    }

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SelectProposalAction.OPERATIONS.showProposals:
                await this.handleShowProposals(interaction);
                break;
            case SelectProposalAction.OPERATIONS.selectProposal:
                await this.handleSelectProposal(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    public async renderHandleShowProposals(interaction: TrackedInteraction, frId?: string): Promise<void> {
        let fundingRoundId: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'fundingRoundId');
        if (frId) {
            fundingRoundId = frId;
        }

        if (!fundingRoundId) {
            await DiscordStatus.Error.error(interaction, 'Funding Round ID not found in customId or arg');
            throw new EndUserError(`Funding Round ID not found in customId or context or arg`);
        }

        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction, frId);
        const proposals = await this.getItemsForPage(interaction, currentPage, frId);

        if (proposals.length === 0) {
            await DiscordStatus.Info.info(interaction, 'There are no proposals for this funding round.');
            return;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'selectProposal', 'fundingRoundId', fundingRoundId))
            .setPlaceholder('Select a Proposal')
            .addOptions(proposals.map(p => ({
                label: p.name,
                value: p.id.toString(),
                description: `Status: ${p.status}, Budget: ${p.budget}`
            })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        await interaction.update({ components });
    }

    private async handleShowProposals(interaction: TrackedInteraction): Promise<void> {
        return await this.renderHandleShowProposals(interaction);
    }

    private async handleSelectProposal(interaction: TrackedInteraction): Promise<void> {

        const parsedInteraction: AnyInteractionWithValues | undefined = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
        if (!parsedInteraction) {
            await DiscordStatus.Error.error(interaction, 'Interaction does not have values');
            throw new EndUserError('Interaction does not have values');
        }

        const proposalId = parsedInteraction.values[0];
        interaction.Context.set('proposalId', proposalId);

        await (this.screen as ManageProposalStatusesScreen).updateProposalStatusAction.renderShowStatusOptions(interaction, proposalId);
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(fundingRoundId: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'showProposals', 'fundingRoundId', fundingRoundId))
            .setLabel('Select Proposal')
            .setStyle(ButtonStyle.Primary);
    }
}

export class UpdateProposalStatusAction extends Action {
    public static readonly ID = 'updateProposalStatus';

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case 'showStatusOptions':
                await this.handleShowStatusOptions(interaction);
                break;
            case 'updateStatus':
                await this.handleUpdateStatus(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    public async renderShowStatusOptions(interaction: TrackedInteraction, pId?:string): Promise<void> {
        
        const proposalIdFromCntx: string | undefined = interaction.Context.get('proposalId');
        const proposalIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'proposalId');
        
        const proposalId: string | undefined = pId || proposalIdFromCntx || proposalIdFromCustomId;        

        if (!proposalId) {
            await DiscordStatus.Error.error(interaction, 'Proposal ID not found in customId, context or arg.');
            return;
        }

        const proposal = await AdminProposalLogic.getProposalById(parseInt(proposalId));
        if (!proposal) {
            await DiscordStatus.Error.error(interaction, 'Proposal not found');
            return;
        }

        const statusOptions = Object.values(ProposalStatus).filter(status => status !== proposal.status);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'updateStatus', 'proposalId', proposalId))
            .setPlaceholder('Select new status')
            .addOptions(statusOptions.map(status => ({
                label: status,
                value: status,
                description: `Change status to ${status}`
            })));

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Update Proposal Status: ${proposal.name}`)
            .setDescription(`Current status: ${proposal.status}`)
            .addFields(
                { name: 'ID', value: proposal.id.toString(), inline: true },
                { name: 'URL', value: proposal.uri, inline: true },
                { name: 'Budget', value: proposal.budget.toString(), inline: true },
                { name: 'Proposer', value: proposal.proposerDuid, inline: true }
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.update({ embeds: [embed], components: [row] });
    
    }

    private async handleShowStatusOptions(interaction: TrackedInteraction): Promise<void> {
        await this.renderShowStatusOptions(interaction);
    }

    private async handleUpdateStatus(interaction: TrackedInteraction): Promise<void> {
        const parsedInteraction: AnyInteractionWithValues | undefined = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);

        if (!parsedInteraction) {
            await DiscordStatus.Error.error(interaction, 'Interaction does not have values');
            throw new EndUserError('Interaction does not have values');
        }

        const proposalIdFromCustomId: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'proposalId');
        const proposalIdFromContext: string | undefined = interaction.Context.get('proposalId');

        const proposalId: string | undefined = proposalIdFromCustomId || proposalIdFromContext;
        if (!proposalId) {
            await DiscordStatus.Error.error(interaction, 'Proposal ID not found in customId or context.');
            return;
        }

        const newStatus = parsedInteraction.values[0] as ProposalStatus;

        try {
            const updatedProposal = await AdminProposalLogic.updateProposalStatus(parseInt(proposalId), newStatus, this.screen);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`Proposal Status Updated: ${updatedProposal.name}`)
                .setDescription(`New status: ${updatedProposal.status}`)
                .addFields(
                    { name: 'ID', value: updatedProposal.id.toString(), inline: true },
                    {name: 'URL', value: updatedProposal.uri, inline: true},
                    { name: 'Budget', value: updatedProposal.budget.toString(), inline: true },
                    { name: 'Proposer', value: updatedProposal.proposerDuid, inline: true }
                );

            const selectPropAction: SelectProposalAction = (this.screen as ManageProposalStatusesScreen).selectProposalAction;

            if (!updatedProposal.fundingRoundId) {
                await DiscordStatus.Warning.warning(interaction, `Proposal does not have a Funding Round associated`);
                throw new EndUserError(`Proposal ${updatedProposal.id} does not have a Funding Round associated`);
            }

            const backButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(selectPropAction, SelectProposalAction.OPERATIONS.showProposals, 'fundingRoundId', updatedProposal.fundingRoundId.toString()))
                .setLabel('Update Status Again')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            await DiscordStatus.Error.error(interaction, `Failed to update proposal status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'showStatusOptions'))
            .setLabel('Update Proposal Status')
            .setStyle(ButtonStyle.Primary);
    }
}