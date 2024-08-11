import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction } from 'discord.js';
import { Topic, SMEGroup, TopicSMEGroupProposalCreationLimiter, sequelize, TopicCommittee } from '../../../models';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { AnyInteractionWithShowModal, AnyModalMessageComponent } from '../../../types/common';
import { TopicAttributes, TopicCommitteeAttributes } from '../../../types';
import { allowedNodeEnvironmentFlags } from 'process';
import { InteractionProperties } from '../../../core/Interaction';
import { parsed } from 'yargs';
import logger from '../../../logging';
import { EndUserError } from '../../../Errors';

interface TopicCommitteeWithSMEGroup extends TopicCommitteeAttributes {
    smeGroupName: string;
  }

export class TopicLogic {

  static getByIdOrError(topicId: number): Promise<Topic> {
    return Topic.findByPk(topicId).then((topic) => {

      if (!topic) {
        throw new EndUserError(`Topic with ID ${topicId} not found`);
      }
    
      return topic;
    });
  }

    static async getTotalTopicsCount(): Promise<number> {
        return await Topic.count();
    }

    static async getAllTopics(): Promise<Topic[]> {
        return await Topic.findAll({
            order: [['name', 'ASC']]
        });
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

    static async deleteTopicWithDependencies(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
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
            throw new EndUserError('Topic not found');
        }

        const smeGroups = await SMEGroup.findAll({
            where: {
                name: smeGroupNames
            }
        });

        if (smeGroups.length !== smeGroupNames.length) {
            const foundNames = smeGroups.map(group => group.name);
            const missingNames = smeGroupNames.filter(name => !foundNames.includes(name));
            throw new EndUserError(`The following SME groups were not found: ${missingNames.join(', ')}`);
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
            throw new EndUserError('Topic not found');
        }

        await topic.update({ name, description });
    }

    static async clearAllowedSMEGroups(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
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
            throw new EndUserError(`The following SME groups were not found: ${missingNames.join(', ')}`);
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

    static async getTopicDetails(topicId: number): Promise<TopicAttributes & { committees: TopicCommitteeAttributes[] }> {
        const topic = await Topic.findByPk(topicId, {
            include: [
                {
                    model: TopicCommittee,
                    as: 'topicCommittees',
                    include: [{ model: SMEGroup, attributes: ['name'] }]
                }
            ]
        });

        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        const committeesQuery: Promise<TopicCommittee[]> = TopicCommittee.findAll({
            where: { topicId: topic.id },
            include: [{ model: SMEGroup, attributes: ['name'] }]
        });

        let committies = []
        for (const committee of await committeesQuery) {
            const smeGroupName = SMEGroup.findByPk(committee.smeGroupId).then(group => group?.name);
            committies.push({
                id: committee.id,
                topicId: committee.topicId,
                smeGroupId: committee.smeGroupId,
                smeGroupName: smeGroupName,
                numUsers: committee.numUsers
            });
        }

        return {
            id: topic.id,
            name: topic.name,
            description: topic.description,
            committees: committies
        };
    }

    static async getTopicCommittees(topicId: number): Promise<TopicCommitteeWithSMEGroup[]> {
        const committees = await TopicCommittee.findAll({
          where: { topicId }
        });
    
        const result: TopicCommitteeWithSMEGroup[] = [];
    
        for (const committee of committees) {
          const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
          if (smeGroup) {
            result.push({
              id: committee.id,
              topicId: committee.topicId,
              smeGroupId: committee.smeGroupId,
              smeGroupName: smeGroup.name,
              numUsers: committee.numUsers
            });
          }
        }
    
        return result;
      }
    
      static async addTopicCommittee(topicId: number, smeGroupName: string, numUsers: number): Promise<TopicCommitteeWithSMEGroup> {
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
          throw new EndUserError('Topic not found');
        }
    
        const smeGroup = await SMEGroup.findOne({ where: { name: smeGroupName } });
        if (!smeGroup) {
          throw new EndUserError('SME Group not found');
        }
    
        const existingCommittee = await TopicCommittee.findOne({
          where: { topicId, smeGroupId: smeGroup.id }
        });
    
        if (existingCommittee) {
          throw new EndUserError('A committee for this SME group already exists for this topic');
        }
    
        const committee = await TopicCommittee.create({
          topicId,
          smeGroupId: smeGroup.id,
          numUsers
        });
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
    
      static async updateTopicCommittee(committeeId: number, numUsers: number): Promise<TopicCommitteeWithSMEGroup> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          throw new EndUserError('Committee not found');
        }
    
        const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
        if (!smeGroup) {
          throw new EndUserError('Associated SME Group not found');
        }
    
        await committee.update({ numUsers });
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
    
      static async removeTopicCommittee(committeeId: number): Promise<void> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          throw new EndUserError('Committee not found');
        }
    
        await committee.destroy();
      }
    
      static async getCommitteeDetails(committeeId: number): Promise<TopicCommitteeWithSMEGroup | null> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          return null;
        }
    
        const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
        if (!smeGroup) {
          throw new EndUserError('Associated SME Group not found');
        }
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
      
      static async getTopicByName(name: string): Promise<Topic | null> {
        return await Topic.findOne({ where: { name } });
      }

}

class TopicsPaginationAction extends PaginationComponent {
    public allSubActions(): Action[] {
        return []
    }
    getComponent(...args: any[]): AnyModalMessageComponent {
        throw new EndUserError('Method not implemented.');
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
    public readonly manageTopicCommitteesAction: ManageTopicCommitteesAction;

    constructor(dashboard: Dashboard, screenId: string) {
        super(dashboard, screenId);
        this.paginationAction = new TopicsPaginationAction(this, TopicsPaginationAction.ID);
        this.selectTopicAction = new SelectTopicAction(this, SelectTopicAction.ID);
        this.addTopicAction = new AddTopicAction(this, AddTopicAction.ID);
        this.removeTopicAction = new RemoveTopicAction(this, RemoveTopicAction.ID);
        this.editTopicAction = new EditTopicAction(this, EditTopicAction.ID);
        this.manageTopicCommitteesAction = new ManageTopicCommitteesAction(this, ManageTopicCommitteesAction.ID);
      }
    
      protected allSubScreens(): Screen[] {
        return [];
      }
    
      protected allActions(): Action[] {
        return [
          this.paginationAction,
          this.selectTopicAction,
          this.addTopicAction,
          this.removeTopicAction,
          this.editTopicAction,
          this.manageTopicCommitteesAction,
        ];
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
            throw new EndUserError('Invalid interaction type.');
        }

        const topicId = parseInt(rawInteraction.values[0]);
        const topicDetails = await TopicLogic.getTopicDetails(topicId);

        if (!topicDetails) {
            throw new EndUserError('Selected topic not found.');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Manage Topic: ${topicDetails.name} [${topicDetails.id}]`)
            .setDescription(topicDetails.description);

        // Add allowed SME groups information
        const allSmeGroupsQuery: TopicSMEGroupProposalCreationLimiter[] = await TopicSMEGroupProposalCreationLimiter.findAll({
            where: { topicId: topicDetails.id },
            include: [{ model: SMEGroup, attributes: ['name'] }]
        });

        let allAllowedSMEGroups: string[] = [];
        for (const limiter of allSmeGroupsQuery) {
            const group = await SMEGroup.findByPk(limiter.smeGroupId);
            if (group) {
                allAllowedSMEGroups.push(group.name);
            }
        }


        if (allAllowedSMEGroups.length > 0) {
            embed.addFields({ name: 'Allowed SME Groups', value: allAllowedSMEGroups.join(', ') });
        } else {
            embed.addFields({ name: 'Allowed SME Groups', value: 'All groups allowed' });
        }

        // Add committee information
        if (topicDetails.committees.length > 0) {
            const committeeInfos: string[] = await Promise.all(topicDetails.committees.map(async committee => {
                const smeGroupName = await SMEGroup.findByPk(committee.smeGroupId).then(group => group ? group.name : 'invalid');
                return `${smeGroupName}: ${committee.numUsers} members`
            }
            ));

            const committeeInfo = committeeInfos.join('\n');
            embed.addFields({ name: 'Committees', value: committeeInfo });
        } else {
            embed.addFields({ name: 'Committees', value: 'No committees set' });
        }

        const removeButton = (this.screen as ManageTopicsScreen).removeTopicAction.getComponent(topicDetails.id);
        const editButton = (this.screen as ManageTopicsScreen).editTopicAction.getComponent(topicDetails.id);
        const manageCommitteesButton = (this.screen as ManageTopicsScreen).manageTopicCommitteesAction.getComponent(topicDetails.id);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(editButton, manageCommitteesButton, removeButton);

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
            throw new EndUserError('This interaction does not support modals');
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
            throw new EndUserError('Only modal submit interactions are supported for this operation.');
        }

        const name = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.NAME);
        const description = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.DESCRIPTION);
        const allowedSMEGroups = rawInteraction.fields.getTextInputValue(AddTopicAction.InputIds.ALLOWED_SME_GROUPS);

        if (!name || !description) {
            throw new EndUserError('Please fill out all required fields');
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
            logger.error(err);
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
            throw new EndUserError('Invalid topic ID.');
        }

        try {
            const topic = await TopicLogic.getTopicById(parseInt(topicId));
            if (!topic) {
                throw new EndUserError('Topic not found.');
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
            logger.error('Error fetching topic details:', error);
            throw new EndUserError('An error occurred while fetching topic details. Please try again later.')
        }
    }

    private async handleExecuteRemove(interaction: TrackedInteraction): Promise<void> {
        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            throw new EndUserError('Invalid topic ID.');
        }

        try {
            await TopicLogic.deleteTopic(parseInt(topicId));
            const successMessage = 'Topic has been successfully removed.';
            await this.screen.render(interaction, { successMessage });
        } catch (error) {
            logger.error('Error removing Topic:', error);
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
            throw new EndUserError('Invalid topic ID.');
        }

        const topicDetails = await TopicLogic.getTopicDetails(parseInt(topicId));
        if (!topicDetails) {
            throw new EndUserError('Topic not found.');
        }

        const rawInteraction = interaction.interaction;
        if (!('showModal' in rawInteraction)) {
            throw new EndUserError('This interaction does not support modals');
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

        const topicLimiters: TopicSMEGroupProposalCreationLimiter[] = await TopicSMEGroupProposalCreationLimiter.findAll({
            where: { topicId: topicDetails.id },
            include: [{ model: SMEGroup, attributes: ['name'] }]
        });

        const allAllowedSMEGroups: string[] = [];
        
        for (const limiter of topicLimiters) {
            const group = await SMEGroup.findByPk(limiter.smeGroupId);
            if (group) {
                allAllowedSMEGroups.push(group.name);
            }
        }

        const allowedSMEGroupsInput = new TextInputBuilder()
            .setCustomId(EditTopicAction.InputIds.ALLOWED_SME_GROUPS)
            .setLabel('Allowed SME Groups (comma-separated names)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(allAllowedSMEGroups.join(', '));

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
            throw new EndUserError('Only modal submit interactions are supported for this operation.');
        }

        const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        if (!topicId) {
            throw new EndUserError('Invalid topic ID.');
        }

        const name = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.NAME);
        const description = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.DESCRIPTION);
        const allowedSMEGroups = rawInteraction.fields.getTextInputValue(EditTopicAction.InputIds.ALLOWED_SME_GROUPS);

        if (!name || !description) {
            throw new EndUserError('Please fill out all required fields');
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
            logger.error(err);
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

export class ManageTopicCommitteesAction extends Action {
  public static readonly ID = 'manageTopicCommittees';

  private committeePaginationAction: CommitteePaginationAction;

  constructor(screen: Screen, actionId: string) {
    super(screen, actionId);
    this.committeePaginationAction = new CommitteePaginationAction(screen, CommitteePaginationAction.ID);
  }

  public static readonly Operations = {
    VIEW_COMMITTEES: 'view_committees',
    ADD_COMMITTEE_FORM: 'add_committee_form',
    ADD_COMMITTEE_SUBMIT: 'add_committee_submit',
    EDIT_COMMITTEE_FORM: 'edit_committee_form',
    EDIT_COMMITTEE_SUBMIT: 'edit_committee_submit',
    REMOVE_COMMITTEE_CONFIRM: 'remove_committee_confirm',
    REMOVE_COMMITTEE_EXECUTE: 'remove_committee_execute',
  };

  private static readonly InputIds = {
    SME_GROUP_NAME: 'sme_group_name',
    NUM_USERS: 'num_users',
  };

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case ManageTopicCommitteesAction.Operations.VIEW_COMMITTEES:
        await this.committeePaginationAction.handlePagination(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.ADD_COMMITTEE_FORM:
        await this.handleAddCommitteeForm(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.ADD_COMMITTEE_SUBMIT:
        await this.handleAddCommitteeSubmit(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.EDIT_COMMITTEE_FORM:
        await this.handleEditCommitteeForm(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.EDIT_COMMITTEE_SUBMIT:
        await this.handleEditCommitteeSubmit(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.REMOVE_COMMITTEE_CONFIRM:
        await this.handleRemoveCommitteeConfirm(interaction);
        break;
      case ManageTopicCommitteesAction.Operations.REMOVE_COMMITTEE_EXECUTE:
        await this.handleRemoveCommitteeExecute(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleAddCommitteeForm(interaction: TrackedInteraction): Promise<void> {
    const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
    if (!topicId) {
      throw new EndUserError('Invalid topic ID.');
    }

    let parsedInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);

    if (!parsedInteraction) {
      throw new EndUserError('Interaction without .showModal() is not supported');
    }

    const modal = new ModalBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageTopicCommitteesAction.Operations.ADD_COMMITTEE_SUBMIT, 'topicId', topicId))
      .setTitle('Add New Committee');

    const smeGroupNameInput = new TextInputBuilder()
      .setCustomId(ManageTopicCommitteesAction.InputIds.SME_GROUP_NAME)
      .setLabel('SME Group Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const numUsersInput = new TextInputBuilder()
      .setCustomId(ManageTopicCommitteesAction.InputIds.NUM_USERS)
      .setLabel('Number of Required Members')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(smeGroupNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(numUsersInput)
    );

    await parsedInteraction.showModal(modal);
  }

  private async handleAddCommitteeSubmit(interaction: TrackedInteraction): Promise<void> {
    const topicId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
    if (!topicId) {
      throw new EndUserError('Invalid topic ID.');
    }

    const parsedInteraction = InteractionProperties.toInteractionWithFieldsOrUndefined(interaction.interaction);

    if (!parsedInteraction) {
      throw new EndUserError('Interaction without fields is not supported')
      return
    }

    const smeGroupName = parsedInteraction.fields.getTextInputValue(ManageTopicCommitteesAction.InputIds.SME_GROUP_NAME);
    const numUsers = parseInt(parsedInteraction.fields.getTextInputValue(ManageTopicCommitteesAction.InputIds.NUM_USERS));

    if (isNaN(numUsers)) {
      throw new EndUserError('Invalid input. Please enter a valid number for required members.');
    }

    try {
      await TopicLogic.addTopicCommittee(parseInt(topicId), smeGroupName, numUsers);
      await this.committeePaginationAction.handlePagination(interaction);
    } catch (error) {
      await interaction.respond({ content: `Error adding committee: ${this.getDetailedErrorMessage(error)}`, ephemeral: true });
    }
  }

  private async handleEditCommitteeForm(interaction: TrackedInteraction): Promise<void> {

    const parsedInteraction = InteractionProperties.toShowModalOrUndefined(interaction.interaction);

    if (!parsedInteraction) {
      throw new EndUserError('Interaction without .showModal() is not supported');
    }

    const committeeId = CustomIDOracle.getNamedArgument(interaction.customId, 'committeeId');
    if (!committeeId) {
      throw new EndUserError('Invalid committee ID.');
    }

    const committee = await TopicLogic.getCommitteeDetails(parseInt(committeeId));
    if (!committee) {
      throw new EndUserError('Committee not found.');
    }

    const modal = new ModalBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageTopicCommitteesAction.Operations.EDIT_COMMITTEE_SUBMIT, 'committeeId', committeeId))
      .setTitle(`Edit Committee for ${committee.smeGroupName}`);

    const numUsersInput = new TextInputBuilder()
      .setCustomId(ManageTopicCommitteesAction.InputIds.NUM_USERS)
      .setLabel('Number of Required Members')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(committee.numUsers.toString());

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(numUsersInput)
    );

    await parsedInteraction.showModal(modal);
  }

  private async handleEditCommitteeSubmit(interaction: TrackedInteraction): Promise<void> {

    const parsedInteraction = InteractionProperties.toInteractionWithFieldsOrUndefined(interaction.interaction);

    if (!parsedInteraction) {
      throw new EndUserError('Interaction without fields is not supported')
      return
    }

    const committeeId = CustomIDOracle.getNamedArgument(interaction.customId, 'committeeId');
    if (!committeeId) {
      throw new EndUserError('Invalid committee ID.');
    }

    const numUsers = parseInt(parsedInteraction.fields.getTextInputValue(ManageTopicCommitteesAction.InputIds.NUM_USERS));

    if (isNaN(numUsers)) {
      throw new EndUserError('Invalid input. Please enter a valid number for required members.');
    }

    try {
      await TopicLogic.updateTopicCommittee(parseInt(committeeId), numUsers);
      
      const committee = await TopicCommittee.findByPk(committeeId); 
        if (!committee) {
            throw new EndUserError(`Committee with ID ${committeeId} not found`);
        }
      interaction.Context.set('topicId', committee.topicId.toString());

      await this.committeePaginationAction.handlePagination(interaction);
    } catch (error) {
      await interaction.respond({ content: `Error updating committee: ${this.getDetailedErrorMessage(error)}`, ephemeral: true });
    }
  }

  private async handleRemoveCommitteeConfirm(interaction: TrackedInteraction): Promise<void> {
    const committeeId = CustomIDOracle.getNamedArgument(interaction.customId, 'committeeId');
    if (!committeeId) {
      throw new EndUserError('Invalid committee ID.');
    }

    const committee = await TopicLogic.getCommitteeDetails(parseInt(committeeId));
    if (!committee) {
      throw new EndUserError('Committee not found.');
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`Confirm Remove Committee`)
      .setDescription(`Are you sure you want to remove the committee for ${committee.smeGroupName} with ${committee.numUsers} required members?`);

    const confirmButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageTopicCommitteesAction.Operations.REMOVE_COMMITTEE_EXECUTE, 'committeeId', committeeId))
      .setLabel('Confirm Remove')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageTopicCommitteesAction.Operations.VIEW_COMMITTEES, 'topicId', committee.topicId.toString()))
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(confirmButton, cancelButton);

    await interaction.update({ embeds: [embed], components: [row] });
  }

  private async handleRemoveCommitteeExecute(interaction: TrackedInteraction): Promise<void> {
    const committeeId = CustomIDOracle.getNamedArgument(interaction.customId, 'committeeId');
    if (!committeeId) {
      throw new EndUserError('Invalid committee ID.');
    }

    try {
      const committee: TopicCommitteeWithSMEGroup | null = await TopicLogic.getCommitteeDetails(parseInt(committeeId));

      if (!committee) {
        await interaction.respond({ content: `Topic for commitee '${committeeId} not found`, ephemeral: true });
        return;
      }

      interaction.Context.set('topicId', committee.topicId.toString());

      await TopicLogic.removeTopicCommittee(parseInt(committeeId));
      await this.committeePaginationAction.handlePagination(interaction);
    } catch (error) {
      await interaction.respond({ content: `Error removing committee: ${this.getDetailedErrorMessage(error)}`, ephemeral: true });
    }
  }

  private getDetailedErrorMessage(error: any): string {
    if (error instanceof Error) {
      if ('name' in error && error.name === 'SequelizeUniqueConstraintError') {
        return 'A committee for this SME group already exists for this topic.';
      } else if ('name' in error && error.name === 'SequelizeForeignKeyConstraintError') {
        return 'The specified SME group does not exist.';
      } else {
        return error.message;
      }
    }
    return 'An unexpected error occurred.';
  }

  public allSubActions(): Action[] {
    return [this.committeePaginationAction];
  }

  getComponent(topicId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageTopicCommitteesAction.Operations.VIEW_COMMITTEES, 'topicId', topicId.toString()))
      .setLabel('Manage Committees')
      .setStyle(ButtonStyle.Primary);
  }
}

export class CommitteePaginationAction extends PaginationComponent {
    public static readonly ID = 'committeePagination';
  
    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
      const topicIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
      const contextTopicId = interaction.Context.get('topicId');

      const topicId = topicIdFromCustomId ? topicIdFromCustomId : contextTopicId;

      if (!topicId) throw new EndUserError('Topic ID not provided');
      const committees = await TopicLogic.getTopicCommittees(parseInt(topicId));
      return Math.ceil(committees.length / 3); // 4 committees per page
    }
  
    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]> {
        const topicIdFromCustomId = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
        const contextTopicId = interaction.Context.get('topicId');
  
        const topicId = topicIdFromCustomId ? topicIdFromCustomId : contextTopicId;
      if (!topicId) throw new EndUserError('Topic ID not provided');
      const committees = await TopicLogic.getTopicCommittees(parseInt(topicId));
      return committees.slice(page * 3, (page + 1) * 3);
    }
  
    public async handlePagination(interaction: TrackedInteraction): Promise<void> {
      const topicIdFromCustomId: string | undefined = CustomIDOracle.getNamedArgument(interaction.customId, 'topicId');
      const topicIdFromContext: string | undefined = interaction.Context.get('topicId');

      const topicId = topicIdFromCustomId ? topicIdFromCustomId : topicIdFromContext;
      
      logger.info('topicIdFromCustomId:', topicIdFromCustomId);
      logger.info('topicIdFromContext:', topicIdFromContext);
      logger.info('topicId:', topicId);

      
      if (!topicId) {
        throw new EndUserError('Topic ID missing.');
      }
  
      const currentPage = this.getCurrentPage(interaction);
      const totalPages = await this.getTotalPages(interaction);
      const committees = await this.getItemsForPage(interaction, currentPage);

      logger.info('currentPage:', currentPage);
      logger.info('totalPages:', totalPages);
      logger.info('committees:', committees);
  
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Committees for Topic`)
        .setDescription(`Page ${currentPage + 1} of ${totalPages}`);
  
      committees.forEach(committee => {
        embed.addFields({ name: `Committee for ${committee.smeGroupName}`, value: `Required Members: ${committee.numUsers}` });
      });
  
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
  
      // Add Edit and Remove buttons for each committee
      committees.forEach(committee => {
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageTopicsScreen).manageTopicCommitteesAction, ManageTopicCommitteesAction.Operations.EDIT_COMMITTEE_FORM, 'committeeId', committee.id.toString()))
              .setLabel(`Edit ${committee.smeGroupName}`)
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(CustomIDOracle.addArgumentsToAction((this.screen as ManageTopicsScreen).manageTopicCommitteesAction, ManageTopicCommitteesAction.Operations.REMOVE_COMMITTEE_CONFIRM, 'committeeId', committee.id.toString()))
              .setLabel(`Remove ${committee.smeGroupName}`)
              .setStyle(ButtonStyle.Danger)
          );
        components.push(row);
      });
  
      // Add pagination buttons
      if (totalPages > 1) {
        components.push(this.getPaginationRow(interaction, currentPage, totalPages));
      }
      
      const action: ManageTopicCommitteesAction = (this.screen as ManageTopicsScreen).manageTopicCommitteesAction;
      // Add "Add Committee" button
      const addButton = new ButtonBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(action, ManageTopicCommitteesAction.Operations.ADD_COMMITTEE_FORM, 'topicId', topicId))
        .setLabel('Add Committee')
        .setStyle(ButtonStyle.Success);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(addButton));

        await interaction.update({ embeds: [embed], components });
    }
  
    public allSubActions(): Action[] {
      return [];
    }
  
    getComponent(...args: any[]): AnyModalMessageComponent {
      throw new Error('Method not implemented.');
    }
  }