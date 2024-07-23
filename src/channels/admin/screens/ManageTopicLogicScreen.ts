import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { Topic, SMEGroup, TopicSMEGroupProposalCreationLimiter, sequelize } from '../../../models';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { AnyModalMessageComponent } from '../../../types/common';
import { TopicAttributes } from '../../../types';


export class TopicLogic {
    static async getTotalTopicsCount(): Promise<number> {
        return await Topic.count();
    }

    static async getPaginatedTopics(page: number, pageSize: number): Promise<Topic[]> {
        return await Topic.findAll({
            order: [['name', 'ASC']],
            limit: pageSize,
            offset: page * pageSize,
        });
    }

    static async getTopicById(id: number): Promise<Topic | null> {
        return await Topic.findByPk(id);
    }

    static async createTopic(name: string, description: string): Promise<Topic> {
        return await Topic.create({ name, description });
    }

    static async deleteTopic(id: number): Promise<void> {
        const topic = await this.getTopicById(id);
        if (topic) {
            await topic.destroy();
        }
    }

    static async getTopicDetails(topicId: number): Promise<TopicAttributes & { allowedSMEGroups: string[] }> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new Error('Topic not found');
        }

        const allowedSMEGroups = await TopicSMEGroupProposalCreationLimiter.findAll({
            where: { topicId: topic.id },
            include: [{ model: SMEGroup, attributes: ['name'] }]
        });

        const allowed: string[] = await Promise.all(allowedSMEGroups.map(async limiter => {
            const smeGroupId = limiter.smeGroupId;
            const smeGroup = await SMEGroup.findByPk(smeGroupId);
            return smeGroup ? smeGroup.name : `${smeGroupId}?`;
        }));

        return {
            id: topic.id,
            name: topic.name,
            description: topic.description,
            allowedSMEGroups: allowed
        };
    }

    static async deleteTopicWithDependencies(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new Error('Topic not found');
        }

        await Topic.sequelize!.transaction(async (t) => {
            // Remove associated records
            await TopicSMEGroupProposalCreationLimiter.destroy({ where: { topicId: topic.id }, transaction: t });

            // TODO: Add logic to handle other dependencies (e.g., proposals, funding rounds)
            // For example:
            // await Proposal.destroy({ where: { topicId: topic.id }, transaction: t });
            // await FundingRound.destroy({ where: { topicId: topic.id }, transaction: t });

            // Delete the topic itself
            await topic.destroy({ transaction: t });
        });
    }

    static async setAllowedSMEGroups(topicId: number, smeGroupNames: string[]): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new Error('Topic not found');
        }

        const smeGroups = await SMEGroup.findAll({
            where: {
                name: smeGroupNames
            }
        });

        if (smeGroups.length !== smeGroupNames.length) {
            const foundNames = smeGroups.map(group => group.name);
            const missingNames = smeGroupNames.filter(name => !foundNames.includes(name));
            throw new Error(`The following SME groups were not found: ${missingNames.join(', ')}`);
        }

        await TopicSMEGroupProposalCreationLimiter.destroy({
            where: { topicId: topic.id }
        });

        for (const smeGroup of smeGroups) {
            await TopicSMEGroupProposalCreationLimiter.create({
                topicId: topic.id,
                smeGroupId: smeGroup.id
            });
        }
    }

    static async updateTopic(topicId: number, name: string, description: string): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new Error('Topic not found');
        }

        await topic.update({ name, description });
    }

    static async clearAllowedSMEGroups(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new Error('Topic not found');
        }

        await TopicSMEGroupProposalCreationLimiter.destroy({
            where: { topicId: topic.id }
        });
    }

    static async validateSMEGroups(smeGroupNames: string[]): Promise<void> {
        const smeGroups = await SMEGroup.findAll({
            where: {
                name: smeGroupNames
            }
        });

        if (smeGroups.length !== smeGroupNames.length) {
            const foundNames = smeGroups.map(group => group.name);
            const missingNames = smeGroupNames.filter(name => !foundNames.includes(name));
            throw new Error(`The following SME groups were not found: ${missingNames.join(', ')}`);
        }
    }

    static async createTopicWithAllowedGroups(name: string, description: string, smeGroupNames: string[]): Promise<Topic> {
        return await sequelize.transaction(async (t) => {
            const topic = await Topic.create({ name, description }, { transaction: t });

            if (smeGroupNames.length > 0) {
                const smeGroups = await SMEGroup.findAll({
                    where: { name: smeGroupNames },
                    transaction: t
                });

                for (const smeGroup of smeGroups) {
                    await TopicSMEGroupProposalCreationLimiter.create({
                        topicId: topic.id,
                        smeGroupId: smeGroup.id
                    }, { transaction: t });
                }
            }

            return topic;
        });
    }

}



class TopicsPaginationAction extends PaginationComponent {
    public allSubActions(): Action[] {
        return []
    }
    getComponent(...args: any[]): AnyModalMessageComponent {
        throw new Error('Method not implemented.');
    }
    public static readonly ID = 'topicsPagination';

    public async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const totalTopics = await TopicLogic.getTotalTopicsCount();
        return Math.ceil(totalTopics / 25);
    }

    public async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]> {
        return await TopicLogic.getPaginatedTopics(page, 25);
    }

    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const topics = await this.getItemsForPage(interaction, currentPage);

        await (this.screen as ManageTopicsScreen).renderTopicList(interaction, topics, currentPage, totalPages);
    }
}

export class ManageTopicsScreen extends Screen {
    public static readonly ID = 'manageTopics';

    protected permissions: Permission[] = []; // access allowed for all

    private paginationAction: TopicsPaginationAction;
    public readonly selectTopicAction: SelectTopicAction;
    public readonly addTopicAction: AddTopicAction;
    public readonly removeTopicAction: RemoveTopicAction;
    public readonly editTopicAction: EditTopicAction;


    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.paginationAction = new TopicsPaginationAction(this, TopicsPaginationAction.ID);
        this.selectTopicAction = new SelectTopicAction(this, SelectTopicAction.ID);
        this.addTopicAction = new AddTopicAction(this, AddTopicAction.ID);
        this.removeTopicAction = new RemoveTopicAction(this, RemoveTopicAction.ID);
        this.editTopicAction = new EditTopicAction(this, EditTopicAction.ID);
    }

    protected allActions(): Action[] {
        return [
            this.paginationAction,
            this.selectTopicAction,
            this.addTopicAction,
            this.removeTopicAction,
            this.editTopicAction,
        ];
    }

    protected allSubScreens(): Screen[] {
        return [];
    }


    protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
        const currentPage = this.paginationAction.getCurrentPage(interaction);
        const totalPages = await this.paginationAction.getTotalPages(interaction);
        const topics = await this.paginationAction.getItemsForPage(interaction, currentPage);

        return this.buildTopicListResponse(interaction, topics, currentPage, totalPages, args);
    }

    public async renderTopicList(interaction: TrackedInteraction, topics: any[], currentPage: number, totalPages: number, args?: RenderArgs): Promise<void> {
        const response = this.buildTopicListResponse(interaction, topics, currentPage, totalPages, args);
        await interaction.update(response);
    }

    private buildTopicListResponse(interaction: TrackedInteraction, topics: any[], currentPage: number, totalPages: number, args?: RenderArgs): any {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Manage Topics')
            .setDescription(`Select a Topic to manage or add a new one. (Page ${currentPage + 1}/${totalPages})`);

        const selectMenu = this.selectTopicAction.getComponent(topics);
        const addButton = this.addTopicAction.getComponent();

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu),
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(addButton),
        ];

        if (totalPages > 1) {
            const paginationRow = this.paginationAction.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        const embeds = [embed];

        if (args?.successMessage) {
            const successEmbed = new EmbedBuilder()
                .setColor('#28a745')
                .setDescription(args.successMessage);
            embeds.push(successEmbed);
        } else if (args?.errorMessage) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#dc3545')
                .setDescription(args.errorMessage);
            embeds.push(errorEmbed);
        }

        return {
            embeds: embeds,
            components,
            ephemeral: true
        };
    }

    private async handleSelectTopic(interaction: TrackedInteraction): Promise<void> {
        const rawInteraction = interaction.interaction;
        if (!('values' in rawInteraction)) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const topicId = parseInt(rawInteraction.values[0]);
        const topicDetails = await TopicLogic.getTopicDetails(topicId);

        if (!topicDetails) {
            await interaction.respond({ content: 'Selected topic not found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Manage Topic: ${topicDetails.name}`)
            .setDescription(topicDetails.description);

        // Add allowed SME groups information
        if (topicDetails.allowedSMEGroups.length > 0) {
            embed.addFields({ name: 'Allowed SME Groups', value: topicDetails.allowedSMEGroups.join(', ') });
        } else {
            embed.addFields({ name: 'Allowed SME Groups', value: 'All groups allowed' });
        }

        const removeButton = this.removeTopicAction.getComponent(topicDetails.id);
        const editButton = this.editTopicAction.getComponent(topicDetails.id);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(editButton, removeButton);

        await interaction.update({ embeds: [embed], components: [row] });
    }
}

class SelectTopicAction extends Action {
    public static readonly ID = 'selectTopic';

    public static readonly Operations = {
        SELECT_TOPIC: 'select_topic',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case SelectTopicAction.Operations.SELECT_TOPIC:
                await this.handleSelectTopic(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleSelectTopic(interaction: TrackedInteraction): Promise<void> {
        const rawInteraction = interaction.interaction;
        if (!('values' in rawInteraction)) {
            await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
            return;
        }

        const topicId = parseInt(rawInteraction.values[0]);
        const topicDetails = await TopicLogic.getTopicDetails(topicId);

        if (!topicDetails) {
            await interaction.respond({ content: 'Selected topic not found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Manage Topic: ${topicDetails.name}`)
            .setDescription(topicDetails.description);

        // Add allowed SME groups information
        if (topicDetails.allowedSMEGroups.length > 0) {
            embed.addFields({ name: 'Allowed SME Groups', value: topicDetails.allowedSMEGroups.join(', ') });
        } else {
            embed.addFields({ name: 'Allowed SME Groups', value: 'All groups allowed' });
        }

        const removeButton = (this.screen as ManageTopicsScreen).removeTopicAction.getComponent(topicDetails.id);
        const editButton = (this.screen as ManageTopicsScreen).editTopicAction.getComponent(topicDetails.id);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(editButton, removeButton);

        await interaction.update({ embeds: [embed], components: [row] });
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(topics: Topic[]): StringSelectMenuBuilder | ButtonBuilder {
        if (topics.length === 0) {
            return new ButtonBuilder()
                .setCustomId('no_topics')
                .setLabel('🗑️ No Topics available')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);
        } else {
            return new StringSelectMenuBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectTopicAction.Operations.SELECT_TOPIC))
                .setPlaceholder('Select a Topic')
                .addOptions(topics.map(topic => ({
                    label: topic.name,
                    value: topic.id.toString(),
                    description: topic.description.substring(0, 100)
                })));
        }
    }
}


class AddTopicAction extends Action {
    public static ID = 'addTopic';

    private static readonly Operations = {
        ADD_TOPIC_FORM: 'add_form',
        ADD_TOPIC_SUBMIT: 'add_form_submit',
    };

    private static readonly InputIds = {
        NAME: 'name',
        DESCRIPTION: 'description',
        ALLOWED_SME_GROUPS: 'allowed_sme_groups',
    };


    protected async handleAddTopicFormDisplay(interaction: TrackedInteraction): Promise<void> {
        const rawInteraction = interaction.interaction;
        if (!('showModal' in rawInteraction)) {
            await interaction.respond({ content: '🚫 This interaction does not support modals', ephemeral: true });
            return;
        }
        const customId = CustomIDOracle.addArgumentsToAction(this, AddTopicAction.Operations.ADD_TOPIC_SUBMIT);
        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('Add New Topic');

        const nameInput = new TextInputBuilder()
            .setCustomId(AddTopicAction.InputIds.NAME)
            .setLabel('Topic Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(AddTopicAction.InputIds.DESCRIPTION)
            .setLabel('Topic Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const allowedSMEGroupsInput = new TextInputBuilder()
            .setCustomId(AddTopicAction.InputIds.ALLOWED_SME_GROUPS)
            .setLabel('Allowed SME Groups (comma-separated names)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Leave blank to allow all groups');

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(allowedSMEGroupsInput)
        );

        await rawInteraction.showModal(modal);
    }

    protected async handleAddTopicFormSubmit(interaction: TrackedInteraction): Promise<void> {
        const rawInteraction = interaction.interaction;
        if (!rawInteraction.isModalSubmit()) {
            await interaction.respond({ content: '🚫 Only modal submit interactions are supported for this operation.', ephemeral: true });
            return;
        }

        const name = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.NAME);
        const description = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.DESCRIPTION);
        const allowedSMEGroups = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.ALLOWED_SME_GROUPS);

        if (!name || !description) {
            await interaction.respond({ content: '🚫 Please fill out all required fields', ephemeral: true });
            return;
        }

        try {
            // Validate SME Group names before creating the topic
            let smeGroupNames: string[] = [];
            if (allowedSMEGroups.trim()) {
                smeGroupNames = allowedSMEGroups.split(',').map(name => name.trim());
                await TopicLogic.validateSMEGroups(smeGroupNames);
            }

            // Create topic and set allowed SME groups in a single transaction
            const topic = await TopicLogic.createTopicWithAllowedGroups(name, description, smeGroupNames);

            const successMessage = `✅ Topic '${name}' created successfully`;
            await this.screen.reRender(interaction, { successMessage: successMessage });
        } catch (err) {
            console.error(err);
            const errorMessage = `🚫 An error occurred while creating the topic '${name}': ${(err as Error).message}`;
            await interaction.respond({ content: errorMessage, ephemeral: true });
        }
    }


    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case AddTopicAction.Operations.ADD_TOPIC_FORM:
                return this.handleAddTopicFormDisplay(interaction);
            case AddTopicAction.Operations.ADD_TOPIC_SUBMIT:
                return this.handleAddTopicFormSubmit(interaction);
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(): ButtonBuilder {
        const customIdWithOperation = CustomIDOracle.addArgumentsToAction(this, AddTopicAction.Operations.ADD_TOPIC_FORM);
        return new ButtonBuilder()
            .setCustomId(customIdWithOperation)
            .setLabel('Add New Topic')
            .setStyle(ButtonStyle.Success);
    }
}

class RemoveTopicAction extends Action {
    public allSubActions(): Action[] {
        return [];
    }
    public static readonly ID = 'removeTopic';

    private static readonly Operations = {
        CONFIRM_REMOVE: 'confirm_remove',
        EXECUTE_REMOVE: 'execute_remove',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case RemoveTopicAction.Operations.CONFIRM_REMOVE:
                await this.handleConfirmRemove(interaction);
                break;
            case RemoveTopicAction.Operations.EXECUTE_REMOVE:
                await this.handleExecuteRemove(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleConfirmRemove(interaction: TrackedInteraction): Promise<void> {
        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            await interaction.respond({ content: 'Invalid topic ID.', ephemeral: true });
            return;
        }

        try {
            const topic = await TopicLogic.getTopicById(parseInt(topicId));
            if (!topic) {
                await interaction.respond({ content: 'Topic not found.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`Confirm Removal of Topic: ${topic.name}`)
                .setDescription('Are you sure you want to remove this Topic?')
                .addFields(
                    { name: 'Description', value: topic.description, inline: false },
                    // Add more fields as needed, e.g., number of proposals, funding rounds, etc.
                );

            const confirmButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveTopicAction.Operations.EXECUTE_REMOVE, 'topicId', topicId))
                .setLabel('Confirm Removal')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId(CustomIDOracle.addArgumentsToAction(
                    (this.screen as ManageTopicsScreen).selectTopicAction,
                    SelectTopicAction.Operations.SELECT_TOPIC,
                    'topicId',
                    topicId
                ))
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(confirmButton, cancelButton);

            await interaction.update({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error fetching topic details:', error);
            await interaction.respond({ content: 'An error occurred while fetching topic details. Please try again later.', ephemeral: true });
        }
    }

    private async handleExecuteRemove(interaction: TrackedInteraction): Promise<void> {
        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            await interaction.respond({ content: 'Invalid topic ID.', ephemeral: true });
            return;
        }

        try {
            await TopicLogic.deleteTopic(parseInt(topicId));
            const successMessage = 'Topic has been successfully removed.';
            await this.screen.render(interaction, { successMessage });
        } catch (error) {
            console.error('Error removing Topic:', error);
            const errorMessage = 'An error occurred while removing the Topic. Please try again later.';
            await this.screen.render(interaction, { errorMessage });
        }
    }

    getComponent(topicId: number): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveTopicAction.Operations.CONFIRM_REMOVE, 'topicId', topicId.toString()))
            .setLabel('Remove Topic')
            .setStyle(ButtonStyle.Danger);
    }
}

class EditTopicAction extends Action {
    public static readonly ID = 'editTopic';

    private static readonly Operations = {
        SHOW_FORM: 'show_form',
        SUBMIT_FORM: 'submit_form',
    };

    private static readonly InputIds = {
        NAME: 'name',
        DESCRIPTION: 'description',
        ALLOWED_SME_GROUPS: 'allowed_sme_groups',
    };

    protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
        switch (operationId) {
            case EditTopicAction.Operations.SHOW_FORM:
                await this.handleShowForm(interaction);
                break;
            case EditTopicAction.Operations.SUBMIT_FORM:
                await this.handleSubmitForm(interaction);
                break;
            default:
                await this.handleInvalidOperation(interaction, operationId);
        }
    }

    private async handleShowForm(interaction: TrackedInteraction): Promise<void> {
        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            await interaction.respond({ content: 'Invalid topic ID.', ephemeral: true });
            return;
        }

        const topicDetails = await TopicLogic.getTopicDetails(parseInt(topicId));
        if (!topicDetails) {
            await interaction.respond({ content: 'Topic not found.', ephemeral: true });
            return;
        }

        const rawInteraction = interaction.interaction;
        if (!('showModal' in rawInteraction)) {
            await interaction.respond({ content: '🚫 This interaction does not support modals', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditTopicAction.Operations.SUBMIT_FORM, 'topicId', topicId))
            .setTitle(`Edit Topic: ${topicDetails.name}`);

        const nameInput = new TextInputBuilder()
            .setCustomId(EditTopicAction.InputIds.NAME)
            .setLabel('Topic Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(topicDetails.name);

        const descriptionInput = new TextInputBuilder()
            .setCustomId(EditTopicAction.InputIds.DESCRIPTION)
            .setLabel('Topic Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(topicDetails.description);

        const allowedSMEGroupsInput = new TextInputBuilder()
            .setCustomId(EditTopicAction.InputIds.ALLOWED_SME_GROUPS)
            .setLabel('Allowed SME Groups (comma-separated names)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(topicDetails.allowedSMEGroups.join(', '));

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(allowedSMEGroupsInput)
        );

        await rawInteraction.showModal(modal);
    }

    private async handleSubmitForm(interaction: TrackedInteraction): Promise<void> {
        const rawInteraction = interaction.interaction;
        if (!rawInteraction.isModalSubmit()) {
            await interaction.respond({ content: '🚫 Only modal submit interactions are supported for this operation.', ephemeral: true });
            return;
        }

        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            await interaction.respond({ content: 'Invalid topic ID.', ephemeral: true });
            return;
        }

        const name = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.NAME);
        const description = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.DESCRIPTION);
        const allowedSMEGroups = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.ALLOWED_SME_GROUPS);

        if (!name || !description) {
            await interaction.respond({ content: '🚫 Please fill out all required fields', ephemeral: true });
            return;
        }

        try {
            await TopicLogic.updateTopic(parseInt(topicId), name, description);

            if (allowedSMEGroups.trim()) {
                const smeGroupNames = allowedSMEGroups.split(',').map(name => name.trim());
                await TopicLogic.setAllowedSMEGroups(parseInt(topicId), smeGroupNames);
            } else {
                await TopicLogic.clearAllowedSMEGroups(parseInt(topicId));
            }

            const successMessage = `✅ Topic '${name}' updated successfully`;
            await this.screen.reRender(interaction, { successMessage: successMessage });
        } catch (err) {
            console.error(err);
            const errorMessage = `🚫 An error occurred while updating the topic '${name}': ${(err as Error).message}`;
            await this.screen.reRender(interaction, { errorMessage: errorMessage });
        }
    }

    public allSubActions(): Action[] {
        return [];
    }

    getComponent(topicId: number): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, EditTopicAction.Operations.SHOW_FORM, 'topicId', topicId.toString()))
            .setLabel('Edit Topic')
            .setStyle(ButtonStyle.Primary);
    }
}

