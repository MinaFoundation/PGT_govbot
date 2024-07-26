import { InteractionResponse } from 'discord.js';
import { Permission } from '../../../core/BaseClasses';
import { TrackedInteraction } from '../../../core/BaseClasses';
import { SMEGroupMembership, SMEGroup } from '../../../models';

export class ZkIgniteFacilitatorPermission extends Permission {
  private static readonly ALLOWED_SME_GROUP = 'zkignite-facilitators';

  public async hasPermission(interaction: TrackedInteraction): Promise<boolean> {
    const userId = interaction.interaction.user.id;

    const smeGroup = await SMEGroup.findOne({
      where: { name: ZkIgniteFacilitatorPermission.ALLOWED_SME_GROUP }
    });

    if (!smeGroup) {
      return false;
    }

    const membership = await SMEGroupMembership.findOne({
      where: {
        smeGroupId: smeGroup.id,
        duid: userId
      }
    });

    return !!membership;
  }

  public async defaultResponse(hasPermission: boolean, interaction: TrackedInteraction): Promise<InteractionResponse<boolean>> {
    if (!hasPermission) {
      return interaction.interaction.reply({
        content: 'You do not have permission to access this channel. Only zkIgnite facilitators can perform this action.',
        ephemeral: true
      });
    }
    return interaction.interaction.reply({ content: 'Permission granted.', ephemeral: true });
  }
}