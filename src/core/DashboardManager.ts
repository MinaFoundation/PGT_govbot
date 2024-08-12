// DashboardManager.ts
import { DiscordStatus } from '../channels/DiscordStatus';
import { EndUserError } from '../Errors';
import logger from '../logging';
import { AnyInteraction, AnyNamedChannelInteraction } from '../types/common';
import { Dashboard, TrackedInteraction } from './BaseClasses';

export class DashboardManager {
  private dashboards: Map<string, Dashboard> = new Map();

  registerDashboard(channelName: string, dashboard: Dashboard): void {
    this.dashboards.set(channelName, dashboard);
  }

  async handleInteraction(interaction: AnyInteraction): Promise<void> {
    const trackedInteratction: TrackedInteraction = new TrackedInteraction(interaction);
    const channelName = this.isNamedChannelInteraction(interaction) ? interaction.channel.name : undefined;
    
    if (!channelName) {
      await DiscordStatus.Error.error(trackedInteratction, 'No channel name found in interaction');
      throw new EndUserError('No channel name found in interaction');
    }


    let parentMostChannelName: string = channelName;

    if (interaction.channel?.isThread()) {
      const parentChannel = interaction.channel.parent;

      if (parentChannel) {
        parentMostChannelName = parentChannel.name;
      }
    }

    const dashboard = this.dashboards.get(parentMostChannelName);
    if (!dashboard) {
      await DiscordStatus.Error.error(trackedInteratction, `No dashboard found for channel '${parentMostChannelName}'`);
      throw new EndUserError(`No dashboard found for channel '${parentMostChannelName}'`);
    }

    await dashboard.handleInteraction(trackedInteratction)
  }

  private isNamedChannelInteraction(interaction: AnyInteraction): interaction is AnyNamedChannelInteraction {
    return interaction.channel !== null && typeof interaction.channel === 'object' && 'name' in interaction.channel;
  }
}