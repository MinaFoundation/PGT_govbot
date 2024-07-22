// src/channels/admin/screens/ManageSMEUsersScreen.ts

import { Screen, Action, Dashboard, Permission, TrackedInteraction} from '../../../core/BaseClasses';
import { AnyInteraction, RenderOptions } from '../../../types/common';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageActionRowComponentBuilder } from 'discord.js';
import { SMEGroup, User } from '../../../models';
import { CustomIDOracle } from '../../../CustomIDOracle';

export class ManageSMEUsersScreen extends Screen {
  public static ID = 'manageSMEUsers';
 
  protected permissions: Permission[] = []; // access allowed for all

  protected selectSMEGroupAction: SelectSMEGroupAction = new SelectSMEGroupAction(this, SelectSMEGroupAction.ID);
  protected addUserToGroupAction: AddUserToGroupAction = new AddUserToGroupAction(this, AddUserToGroupAction.ID);
  protected removeUserFromGroupAction: RemoveUserFromGroupAction = new RemoveUserFromGroupAction(this, RemoveUserFromGroupAction.ID);
  
  protected allSubScreens(): Screen[] {
    return [];
  }
 

  protected allActions(): Action[] {
    return [
      this.selectSMEGroupAction,
      this.addUserToGroupAction,
      this.removeUserFromGroupAction,
    ]
  }

  protected async getResponse(options: RenderOptions): Promise<any> {
    const { interaction } = options;

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Manage SME Users')
      .setDescription('Select an SME Group to manage its users.');

    const smeGroups = await SMEGroup.findAll();

    const selectMenu = this.selectSMEGroupAction.getComponent(smeGroups);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    return {
      embeds: [embed],
      components: [row],
      ephemeral: true
    };
  }
}

class SelectSMEGroupAction extends Action {
  public static ID = 'selectSMEGroup';
  protected addUsersToGroupAction: AddUserToGroupAction = new AddUserToGroupAction(this._screen, AddUserToGroupAction.ID);
  protected removeUsersFromGroupAction: RemoveUserFromGroupAction = new RemoveUserFromGroupAction(this._screen, RemoveUserFromGroupAction.ID);

  Operations = {
    SELECT_SME_GROUP: "select_sme_group"
  }


  public allSubActions(): Action[] {
    return [
      this.addUsersToGroupAction,
      this.removeUsersFromGroupAction,
    ]
  }

  protected async handleSelectSmeGroup(interaction: TrackedInteraction) {
    if (!interaction.interaction.isStringSelectMenu()) return;

    const groupId = parseInt(interaction.values[0]);
    const group = await SMEGroup.findByPk(groupId);

    if (!group) {
      await interaction.respond({ content: 'Selected group not found.', ephemeral: true });
      return;
    }

    const users = await User.findAll({ where: { duid: group.duid } });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Manage Users in ${group.name}`)
      .setDescription(`Users in this group: ${users.map(user => user.duid).join(', ') || 'None'}`);

    const addUserButton = this.addUsersToGroupAction.getComponent(group.id.toString());
    const removeUserMenu = this.removeUsersFromGroupAction.getComponent(group.id.toString(), users);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(addUserButton);
    const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeUserMenu);

    await interaction.update({
      embeds: [embed],
      components: [row1, row2],
    });

  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    const rawInteraction: AnyInteraction = interaction.interaction;
    if (operationId === this.Operations.SELECT_SME_GROUP) {
      return await this.handleSelectSmeGroup(rawInteraction);
    } else {
      await this.handleInvalidOperation(interaction, operationId);
    }
  }

  getComponent(smeGroups: SMEGroup[]): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, this.Operations.SELECT_SME_GROUP))
      .setPlaceholder('Select an SME Group')
      .addOptions(smeGroups.map(group => ({
        label: group.name,
        value: group.id.toString(),
        description: group.description
      })));
  }
}

class AddUserToGroupAction extends Action {

  public static ID = 'addUserToGroup';

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    const rawInteraction = interaction.interaction;
    if (!rawInteraction.isButton()) return;

    const [groupId] = CustomIDOracle.getArguments(interaction.customId);

    const modal = {
      title: 'Add User to SME Group',
      custom_id: CustomIDOracle.addArgumentsToAction(this, 'modal', groupId),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'userId',
              label: 'User ID',
              style: 1,
              min_length: 1,
              max_length: 20,
              placeholder: 'Enter the Discord User ID',
              required: true
            }
          ]
        }
      ]
    };

    await rawInteraction.showModal(modal);
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(groupId: string): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.generateCustomId(this._screen.dashboard, this._screen, this, undefined, groupId))
      .setLabel('Add User to Group')
      .setStyle(ButtonStyle.Success);
  }
}

class RemoveUserFromGroupAction extends Action {
  public static ID = 'removeUserFromGroup';

  static Operations = {
    REMOVE_USER: 'removeUser',
  };

  protected async handleRemoveUser(interaction: TrackedInteraction): Promise<void> {
    const rawInteraction = interaction.interaction;
    if (!rawInteraction.isStringSelectMenu()) return;

    // TODO: extract SMEGroup to remove the user(duid) from and the User(duid) from arguments
    
    // Re-render the screen to show updated list
    await this._screen.render(interaction);
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    if (operationId == RemoveUserFromGroupAction.Operations.REMOVE_USER) {
      // all operation handlers must be defined in separate methods.
      await this.handleRemoveUser(interaction);
    } else {
      await this.handleInvalidOperation(interaction, operationId);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(groupId: string, users: User[]): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, RemoveUserFromGroupAction.Operations.REMOVE_USER, groupId))
      .setPlaceholder('Select a user to remove')
      .addOptions(users.map(user => ({
        label: user.duid.toString(),
        value: user.duid.toString()
      })));
  }
}