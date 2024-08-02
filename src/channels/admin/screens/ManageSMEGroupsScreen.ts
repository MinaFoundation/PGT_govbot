// src/channels/admin/screens/ManageSMEGroupsScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction, RenderArgs } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import { SMEGroup, SMEGroupMembership, User } from '../../../models';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { AnyInteraction, AnyInteractionWithValues, AnyModalMessageComponent } from '../../../types/common';
import { PaginationComponent } from '../../../components/PaginationComponent';
import { PaginationLogic } from '../../../utils/Pagination';
import { InteractionProperties } from '../../../core/Interaction';
import logger from '../../../logging';


export class SMEGroupLogic {
  static async getTotalGroupsCount(): Promise<number> {
    return await SMEGroup.count();
  }

  static async getPaginatedGroups(page: number, pageSize: number): Promise<SMEGroup[]> {
    return await SMEGroup.findAll({
      order: [['name', 'ASC']],
      limit: pageSize,
      offset: page * pageSize,
    });
  }

  static async getGroupById(id: number): Promise<SMEGroup | null> {
    return await SMEGroup.findByPk(id);
  }

  static async createGroup(name: string, description: string): Promise<SMEGroup> {
    return await SMEGroup.create({ name, description });
  }

  static async deleteGroup(id: number): Promise<void> {
    const group = await this.getGroupById(id);
    if (group) {
      await group.destroy();
    }
  }

  static async getGroupMemberCount(groupId: number): Promise<number> {
    return await SMEGroupMembership.count({
      where: { smeGroupId: groupId }
    });
  }

  static async getPaginatedGroupMembers(groupId: number, page: number, pageSize: number): Promise<string[]> {
    const memberships = await SMEGroupMembership.findAll({
      where: { smeGroupId: groupId },
      limit: pageSize,
      offset: page * pageSize,
    });
    return memberships.map(membership => membership.duid);
  }

  static async getGroupMembers(groupId: number): Promise<string[]> {
    const memberships = await SMEGroupMembership.findAll({
      where: { smeGroupId: groupId },
    });
    return memberships.map(membership => membership.duid);
  }

  static async removeMemberFromGroup(groupId: number, duid: string): Promise<void> {
    await SMEGroupMembership.destroy({
      where: {
        smeGroupId: groupId,
        duid: duid,
      },
    });
  }

  static async isUserMemberOfGroup(groupId: number, duid: string): Promise<boolean> {
    const membership = await SMEGroupMembership.findOne({
      where: {
        smeGroupId: groupId,
        duid: duid,
      },
    });
    return !!membership;
  }

  static async addMembersToGroup(groupId: number, duids: string[]): Promise<{ added: number; skipped: number }> {
    const result = { added: 0, skipped: 0 };

    await SMEGroup.sequelize!.transaction(async (t) => {
      const existingMemberships = await SMEGroupMembership.findAll({
        where: {
          smeGroupId: groupId,
          duid: duids,
        },
        transaction: t,
      });

      const existingDuids = new Set(existingMemberships.map(membership => membership.duid));

      for (const duid of duids) {
        if (existingDuids.has(duid)) {
          result.skipped++;
        } else {
          await SMEGroupMembership.create({
            smeGroupId: groupId,
            duid: duid,
          }, { transaction: t });
          result.added++;
        }
      }
    });

    return result;
  }

  static async removeMembersFromGroup(groupId: number, duids: string[]): Promise<number> {
    const result = await SMEGroupMembership.destroy({
      where: {
        smeGroupId: groupId,
        duid: duids,
      },
    });
    return result;
  }

  static async getGroupDetails(groupId: number): Promise<{ name: string; memberCount: number; dependencies: string[] }> {
    const group = await SMEGroup.findByPk(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const memberCount = await SMEGroupMembership.count({ where: { smeGroupId: groupId } });

    // TODO: check for any other dependencies (e.g., proposals, funding rounds)
    // For now, we'll assume there are no other dependencies
    const dependencies: string[] = [];

    return {
      name: group.name,
      memberCount,
      dependencies,
    };
  }

  static async deleteGroupWithDependencies(groupId: number): Promise<void> {
    await SMEGroup.sequelize!.transaction(async (t) => {
      // Delete all memberships
      await SMEGroupMembership.destroy({
        where: { smeGroupId: groupId },
        transaction: t,
      });

      // Delete the group itself
      await SMEGroup.destroy({
        where: { id: groupId },
        transaction: t,
      });

      // TODO: later, delete/clear out all dependencies with cascading
    });
  }
}

class SMEGroupsPaginationAction extends PaginationComponent {
  public allSubActions(): Action[] {
    return []
  }
  getComponent(...args: any[]): AnyModalMessageComponent {
    throw new Error('Method not implemented.');
  }
  public static readonly ID = 'smeGroupsPagination';

  public async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const totalGroups = await SMEGroupLogic.getTotalGroupsCount();
    return Math.ceil(totalGroups / 25);
  }

  public async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]> {
    return await SMEGroupLogic.getPaginatedGroups(page, 25);
  }

  public async handlePagination(interaction: TrackedInteraction): Promise<void> {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const groups = await this.getItemsForPage(interaction, currentPage);

    await (this.screen as ManageSMEGroupsScreen).renderGroupList(interaction, groups, currentPage, totalPages);
  }
}

export class ManageSMEGroupsScreen extends Screen {
  public static readonly ID = 'manageSMEGroups';

  protected permissions: Permission[] = []; // access allowed for all

  private paginationAction: SMEGroupsPaginationAction;
  public readonly selectSMEGroupAction: SelectSMEGroupAction;
  public readonly addSMEGroupAction: AddSMEGroupAction;
  public readonly removeSMEGroupAction: RemoveSMEGroupAction;
  public readonly manageMembersAction: ManageMembersAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.paginationAction = new SMEGroupsPaginationAction(this, SMEGroupsPaginationAction.ID);
    this.selectSMEGroupAction = new SelectSMEGroupAction(this, SelectSMEGroupAction.ID);
    this.addSMEGroupAction = new AddSMEGroupAction(this, AddSMEGroupAction.ID);
    this.removeSMEGroupAction = new RemoveSMEGroupAction(this, RemoveSMEGroupAction.ID);
    this.manageMembersAction = new ManageMembersAction(this, ManageMembersAction.ID);
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [
      this.paginationAction,
      this.selectSMEGroupAction,
      this.addSMEGroupAction,
      this.removeSMEGroupAction,
      this.manageMembersAction,
    ];
  }

  protected async getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any> {
    const currentPage = this.paginationAction.getCurrentPage(interaction);
    const totalPages = await this.paginationAction.getTotalPages(interaction);
    const groups = await this.paginationAction.getItemsForPage(interaction, currentPage);

    return this.buildGroupListResponse(interaction, groups, currentPage, totalPages, args);
  }

  public async renderGroupList(interaction: TrackedInteraction, groups: any[], currentPage: number, totalPages: number, args?: RenderArgs): Promise<void> {
    const response = this.buildGroupListResponse(interaction, groups, currentPage, totalPages, args);
    await interaction.update(response);
  }

  private buildGroupListResponse(interaction: TrackedInteraction, groups: any[], currentPage: number, totalPages: number, args?: RenderArgs): any {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Manage SME Groups')
      .setDescription(`Select an SME Group to manage or add a new one. (Page ${currentPage + 1}/${totalPages})`);

    const selectMenu = this.selectSMEGroupAction.getComponent(groups);
    const addButton = this.addSMEGroupAction.getComponent();

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

class SelectSMEGroupAction extends Action {
  public static readonly ID = 'selectSMEGroup';

  public static readonly Operations = {
    SELECT_GROUP: 'select_group',
  };

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case SelectSMEGroupAction.Operations.SELECT_GROUP:
        await this.handleSelectGroup(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleSelectGroup(interaction: TrackedInteraction): Promise<void> {
    const rawInteraction = interaction.interaction;
    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(rawInteraction);

    if (!interactionWithValues) {
      await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
      return;
    }

    const groupId = parseInt(interactionWithValues.values[0]);
    const group = await SMEGroupLogic.getGroupById(groupId);

    if (!group) {
      await interaction.respond({ content: 'Selected group not found.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Manage SME Group: ${group.name}`)
      .setDescription(group.description)
      .addFields({ name: 'Members', value: (await SMEGroupLogic.getGroupMemberCount(group.id)).toString() });

    const removeButton = (this.screen as ManageSMEGroupsScreen).removeSMEGroupAction.getComponent(group.id);
    const manageMembersButton = (this.screen as ManageSMEGroupsScreen).manageMembersAction.getComponent(group.id);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(removeButton, manageMembersButton);

    await interaction.update({ embeds: [embed], components: [row] });
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(groups: SMEGroup[]): StringSelectMenuBuilder | ButtonBuilder {
    if (groups.length === 0) {
      return new ButtonBuilder()
        .setCustomId('no_sme_groups')
        .setLabel('🗑️ No SME Groups available')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    } else {
      return new StringSelectMenuBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(this, SelectSMEGroupAction.Operations.SELECT_GROUP))
        .setPlaceholder('Select an SME Group')
        .addOptions(groups.map(group => ({
          label: group.name,
          value: group.id.toString(),
          description: group.description.substring(0, 100)
        })));
    }
  }
}

class AddSMEGroupAction extends Action {
  public static ID = 'addSMEGroup';

  private static readonly Operations = {
    ADD_SME_GROUP_FORM: 'add_form',
    ADD_SME_GROUP_SUBMIT: 'add_form_submit',
  };

  private static readonly InputIds = {
    NAME: 'name',
    DESCRIPTION: 'description',
  };

  protected async handleAddGroupFormDisplay(interaction: TrackedInteraction): Promise<void> {
    const rawInteraction = interaction.interaction;
    if (!('showModal' in rawInteraction)) {
      await interaction.respond({ content: '🚫 This interaction does not support modals', ephemeral: true });
      return;
    }
    const customId = CustomIDOracle.addArgumentsToAction(this, AddSMEGroupAction.Operations.ADD_SME_GROUP_SUBMIT);
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle('Add New SME Group');

    const nameInput = new TextInputBuilder()
      .setCustomId(AddSMEGroupAction.InputIds.NAME)
      .setLabel('Group Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId(AddSMEGroupAction.InputIds.DESCRIPTION)
      .setLabel('Group Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
    );

    await rawInteraction.showModal(modal);
  }

  protected async handleAddGroupFormSubmit(interaction: TrackedInteraction): Promise<void> {
    const rawInteraction = interaction.interaction;
    if (!rawInteraction.isModalSubmit()) {
      await interaction.respond({ content: '🚫 Only modal submit interactions are supported for this operation.', ephemeral: true });
      return;
    }

    const name = rawInteraction.fields.getTextInputValue(AddSMEGroupAction.InputIds.NAME);
    const description = rawInteraction.fields.getTextInputValue(AddSMEGroupAction.InputIds.DESCRIPTION);

    if (!name || !description) {
      await interaction.respond({ content: '🚫 Please fill out all fields', ephemeral: true });
      return;
    }

    try {
      await SMEGroupLogic.createGroup(name, description);
      const successMessage = `✅ SME Group '${name}' created successfully`;
      await this.screen.reRender(interaction, { successMessage: successMessage });
    } catch (err) {
      logger.error(err);
      const errorMessage = `🚫 An error occurred while creating the group '${name}'`;
      await this.screen.reRender(interaction, { errorMessage: errorMessage });
    }
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case AddSMEGroupAction.Operations.ADD_SME_GROUP_FORM:
        return this.handleAddGroupFormDisplay(interaction);
      case AddSMEGroupAction.Operations.ADD_SME_GROUP_SUBMIT:
        return this.handleAddGroupFormSubmit(interaction);
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    const customIdWithOperation = CustomIDOracle.addArgumentsToAction(this, AddSMEGroupAction.Operations.ADD_SME_GROUP_FORM);
    return new ButtonBuilder()
      .setCustomId(customIdWithOperation)
      .setLabel('Add New SME Group')
      .setStyle(ButtonStyle.Success);
  }
}

class RemoveSMEGroupAction extends Action {
  public allSubActions(): Action[] {
    return [];
  }
  public static readonly ID = 'removeSMEGroup';

  private static readonly Operations = {
    CONFIRM_REMOVE: 'confirm_remove',
    EXECUTE_REMOVE: 'execute_remove',
  };

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case RemoveSMEGroupAction.Operations.CONFIRM_REMOVE:
        await this.handleConfirmRemove(interaction);
        break;
      case RemoveSMEGroupAction.Operations.EXECUTE_REMOVE:
        await this.handleExecuteRemove(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleConfirmRemove(interaction: TrackedInteraction): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    try {
      const groupDetails = await SMEGroupLogic.getGroupDetails(parseInt(groupId));

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`Confirm Removal of SME Group: ${groupDetails.name}`)
        .setDescription('Are you sure you want to remove this SME Group?')
        .addFields(
          { name: 'Members', value: groupDetails.memberCount.toString(), inline: true },
          { name: 'Dependencies', value: groupDetails.dependencies.length > 0 ? groupDetails.dependencies.join(', ') : 'None', inline: true }
        );

      const confirmButton = new ButtonBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveSMEGroupAction.Operations.EXECUTE_REMOVE, 'groupId', groupId))
        .setLabel('Confirm Removal')
        .setStyle(ButtonStyle.Danger);

      const localScreen: ManageSMEGroupsScreen = this.screen as ManageSMEGroupsScreen;

      const cancelButton = new ButtonBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(localScreen.selectSMEGroupAction, SelectSMEGroupAction.Operations.SELECT_GROUP, 'groupId', groupId))
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
      logger.error('Error fetching group details:', error);
      await interaction.respond({ content: 'An error occurred while fetching group details. Please try again later.', ephemeral: true });
    }
  }

  private async handleExecuteRemove(interaction: TrackedInteraction): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    try {
      await SMEGroupLogic.deleteGroupWithDependencies(parseInt(groupId));
      const successMessage = 'SME Group has been successfully removed along with all its dependencies.';
      await this.screen.render(interaction, { successMessage });
    } catch (error) {
      logger.error('Error removing SME Group:', error);
      const errorMessage = 'An error occurred while removing the SME Group. Please try again later.';
      await this.screen.render(interaction, { errorMessage });
    }
  }

  getComponent(groupId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveSMEGroupAction.Operations.CONFIRM_REMOVE, 'groupId', groupId.toString()))
      .setLabel('Remove SME Group')
      .setStyle(ButtonStyle.Danger);
  }
}

class ManageMembersAction extends PaginationComponent {
  public allSubActions(): Action[] {
    return [];
  }
  public static readonly ID = 'manageMembers';

  private static readonly Operations = {
    VIEW_MEMBERS: 'view_members',
    ADD_MEMBERS: 'add_members',
    ADD_MEMBERS_SUBMIT: 'add_members_submit',
    REMOVE_MEMBERS: 'remove_members',
    REMOVE_MEMBERS_SUBMIT: 'remove_members_submit',
  };

  protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) return 0;
    const totalMembers = await SMEGroupLogic.getGroupMemberCount(parseInt(groupId));
    return Math.ceil(totalMembers / 10);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) return [];
    return await SMEGroupLogic.getPaginatedGroupMembers(parseInt(groupId), page, 10);
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    logger.info(`Handling operation ${operationId} on ${interaction.customId}`);

    switch (operationId) {
      case ManageMembersAction.Operations.VIEW_MEMBERS:
        await this.handleViewMembers(interaction);
        break;
      case ManageMembersAction.Operations.ADD_MEMBERS:
        await this.handleAddMembers(interaction);
        break;
      case ManageMembersAction.Operations.REMOVE_MEMBERS:
        await this.handleRemoveMembers(interaction);
        break;
      case ManageMembersAction.Operations.REMOVE_MEMBERS_SUBMIT:
        await this.handleRemoveMembersSubmit(interaction);
        break;
      case ManageMembersAction.Operations.ADD_MEMBERS_SUBMIT:
        await this.handleAddMembersSubmit(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleRemoveMembersSubmit(interaction: TrackedInteraction): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
      return;
    }

    const selectedUserIds = interactionWithValues.values;

    try {
      const removedCount = await SMEGroupLogic.removeMembersFromGroup(parseInt(groupId), selectedUserIds);
      const successMessage = `Successfully removed ${removedCount} member(s) from the group.`;
      await this.handleViewMembers(interaction, successMessage);
    } catch (error) {
      logger.error('Error removing members from group:', error);
      const errorMessage = 'An error occurred while removing members from the group. Please try again later.';
      await this.screen.reRender(interaction, { errorMessage });
    }
  }

  private async handleViewMembers(interaction: TrackedInteraction, successMessage?: string): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const members = await this.getItemsForPage(interaction, currentPage);

    const group = await SMEGroupLogic.getGroupById(parseInt(groupId));
    if (!group) {
      await interaction.respond({ content: 'Group not found.', ephemeral: true });
      return;
    }

    const allGroupMemberDuids = await SMEGroupLogic.getGroupMembers(parseInt(groupId));


    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Manage Members: ${group.name}`)
      .setDescription(`Total Members: ${allGroupMemberDuids.length}`);

    const addMembersButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageMembersAction.Operations.ADD_MEMBERS, 'groupId', groupId))
      .setLabel('Add Members')
      .setStyle(ButtonStyle.Success);

    const removeMemberButton = new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageMembersAction.Operations.REMOVE_MEMBERS, 'groupId', groupId))
      .setLabel('Remove Member')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(addMembersButton, removeMemberButton);

    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [row];

    if (totalPages > 1) {
      const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
      components.push(paginationRow);
    }

    let embeds = [];
    if (successMessage) {
      const successEmbed = new EmbedBuilder()
        .setColor('#28a745')
        .setDescription(successMessage);
      embeds.push(successEmbed);
    }
    embeds.push(embed);

    await interaction.update({ embeds: embeds, components, ephemeral: true });
  }

  private async handleAddMembers(interaction: TrackedInteraction): Promise<void> {
    logger.info('Handling add members...');
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageMembersAction.Operations.ADD_MEMBERS_SUBMIT, 'groupId', groupId))
      .setPlaceholder('Select users to add (up to 25)')
      .setMaxValues(25);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>()
      .addComponents(userSelect);

    await interaction.update({
      content: 'Select users to add to the group:',
      components: [row],
      ephemeral: true
    });
  }

  private async handleAddMembersSubmit(interaction: TrackedInteraction): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    const interactionWithValues = InteractionProperties.toInteractionWithValuesOrUndefined(interaction.interaction);
    if (!interactionWithValues) {
      await interaction.respond({ content: 'Invalid interaction type.', ephemeral: true });
      return;
    }

    const selectedUserIds = interactionWithValues.values;

    try {
      const result = await SMEGroupLogic.addMembersToGroup(parseInt(groupId), selectedUserIds);
      const successMessage = `Successfully added ${result.added} member(s) to the group. ${result.skipped} member(s) were already in the group and skipped.`;
      await this.handleViewMembers(interaction, successMessage);
    } catch (error) {
      logger.error('Error adding members to group:', error);
      const errorMessage = 'An error occurred while adding members to the group. Please try again later.';
      await this.screen.reRender(interaction, { errorMessage });
    }
  }

  private async handleRemoveMembers(interaction: TrackedInteraction): Promise<void> {
    const groupId = CustomIDOracle.getNamedArgument(interaction.customId, 'groupId');
    if (!groupId) {
      await interaction.respond({ content: 'Invalid group ID.', ephemeral: true });
      return;
    }

    const members = await SMEGroupLogic.getGroupMembers(parseInt(groupId));

    if (members.length === 0) {
      await interaction.respond({ content: 'This group has no members to remove.', ephemeral: true });
      return;
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageMembersAction.Operations.REMOVE_MEMBERS_SUBMIT, 'groupId', groupId))
      .setPlaceholder('Select users to remove (up to 15)')
      .setMaxValues(Math.min(15, members.length));
 
    const row = new ActionRowBuilder<UserSelectMenuBuilder>()
      .addComponents(userSelect);

    await interaction.update({
      content: 'Select users to remove from the group:',
      components: [row],
      ephemeral: true
    });
  }

  public getComponent(groupId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, ManageMembersAction.Operations.VIEW_MEMBERS, 'groupId', groupId.toString()))
      .setLabel('Manage Members')
      .setStyle(ButtonStyle.Primary);
  }
}