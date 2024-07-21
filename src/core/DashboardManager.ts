// DashboardManager.ts
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
      await trackedInteratction.respond({ content: 'Error: Unable to determine the channel.', ephemeral: true });
      return;
    }

    const dashboard = this.dashboards.get(channelName);
    if (!dashboard) {
      await trackedInteratction.respond({ content: 'Error: No dashboard found for this channel.', ephemeral: true });
      return;
    }

    await dashboard.handleInteraction(trackedInteratction)
  }

  private isNamedChannelInteraction(interaction: AnyInteraction): interaction is AnyNamedChannelInteraction {
    return interaction.channel !== null && typeof interaction.channel === 'object' && 'name' in interaction.channel;
  }
}