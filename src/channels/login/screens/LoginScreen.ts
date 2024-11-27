import { Screen, Dashboard, Permission, Action, TrackedInteraction } from '../../../core/BaseClasses';
import { IHomeScreen } from '../../../types/common';
import { GenerateLoginTokenAction } from '../actions/GenerateLoginTokenAction';
import { LoginForumManager } from '../LoginForumManager';
import { TextChannel } from 'discord.js';

export class LoginScreen extends Screen implements IHomeScreen {
  public static readonly ID = 'login';
  public static readonly DEFAULT_FORUM_CHANNEL_ID = '1301096522452303894';

  protected permissions: Permission[] = []; // access allowed for all
  public readonly generateLoginTokenAction: GenerateLoginTokenAction;

  constructor(dashboard: Dashboard, screenId: string) {
    super(dashboard, screenId);
    this.generateLoginTokenAction = new GenerateLoginTokenAction(this, GenerateLoginTokenAction.ID);
  }

  protected allSubScreens(): Screen[] {
    return [];
  }

  protected allActions(): Action[] {
    return [this.generateLoginTokenAction];
  }

  public async renderToTextChannel(channel: TextChannel): Promise<void> {
    const channelId = process.env.LOGIN_FORUM_CHANNEL_ID || LoginScreen.DEFAULT_FORUM_CHANNEL_ID;
    await LoginForumManager.initialize(channelId, this);
  }

  protected async getResponse(interaction: TrackedInteraction): Promise<any> {
    // This screen doesn't need to respond to interactions directly
    // All interactions are handled by the GenerateLoginTokenAction
    return {
      content: 'Please use the login interface in the forum channel.',
      ephemeral: true
    };
  }
} 