import { AnyInteraction } from '../types/common';
import { Action, Dashboard, Screen } from './BaseClasses';

export abstract class BaseDashboard extends Dashboard {
  protected abstract readonly initialScreenClass: typeof Screen;

  async render(interaction: AnyInteraction): Promise<void> {
    const customId = this.parseCustomId(interaction.customId);
    
    if (!customId) {
      await this.renderInitialScreen(interaction);
      return;
    }

    const [screenId, actionId, ...args] = customId.split(':');
    const screen: Screen | undefined = this.getScreen(screenId);

    if (!screen) {
      await interaction.reply({ content: 'Error: Invalid screen.', ephemeral: true });
      return;
    }

    const action: Action | undefined = screen.getAction(actionId);

    if (!action) {
      await interaction.reply({ content: 'Error: Invalid action.', ephemeral: true });
      return;
    }

    await action.execute(interaction);
  }

  private async renderInitialScreen(interaction: AnyInteraction): Promise<void> {
    await this.homeScreen.render({ interaction });
  }

  private parseCustomId(customId: string): string | null {
    const parts = customId.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : null;
  }
}