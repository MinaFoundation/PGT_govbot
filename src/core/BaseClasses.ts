// BaseClasses.ts
import { InteractionResponse, Message, MessageComponentInteraction } from 'discord.js';
import { CustomIDOracle } from '../CustomIDOracle';
import { AnyModalMessageComponent, AnyInteraction, HomeScreen, AnyInteractionWithValues } from '../types/common';
import { InteractionProperties } from './Interaction';
import logger from '../logging';
import { EndUserError } from '../Errors';
import { DiscordStatus } from '../channels/DiscordStatus';
import { ModalBuilder } from '@discordjs/builders';

export interface RenderArgs {
  successMessage?: string;
  errorMessage?: string;
}

export class TrackedInteraction {
  public readonly interaction: AnyInteraction;
  public interactionReplies: Message<boolean>[] = [];
  public Context: Map<string, string> = new Map();
  protected _isUpdated: boolean = false;

  constructor(interaction: AnyInteraction) {
    this.interaction = interaction;
  }

  get discordUserId(): string {
    return this.interaction.user.id;
  }

  public getFromCustomId(name: string): string | undefined {
    return CustomIDOracle.getNamedArgument(this.customId, name);
  }

  public getFromValuesCustomIdOrContext(index: number, name: string) {
    const interactionWithValues: AnyInteractionWithValues | undefined = InteractionProperties.toInteractionWithValuesOrUndefined(this.interaction);
    logger.debug(`Looking for value at index ${index} for name ${name}, in ${this.interaction.customId}`);
    if (interactionWithValues) {
      const value = interactionWithValues.values[index];
      logger.debug(`Interaction values: ${interactionWithValues.values}, returning value at index ${index}: ${value}`);
      return value;
    }

    const valueFromCustomId = this.getFromCustomId(name);
    if (valueFromCustomId) {
      logger.debug(`Returning value from custom_id: ${valueFromCustomId}`);
      return valueFromCustomId;
    }

    const valueFromContext = this.Context.get(name);
    if (valueFromContext) {
      logger.debug(`Returning value from context: ${valueFromContext}`);
    }
    return valueFromContext;
  }

  get customId(): string {
    return this.interaction.customId;
  }

  get hasResponses(): boolean {
    return this.interactionReplies.length > 0;
  }

  public async respond(args: any): Promise<Message<boolean>> {
    if (!('ephemeral' in args)) {
      args['ephemeral'] = true;
    }

    try {
      const followUp: boolean = this.interactionReplies.length > 0 || this._isUpdated;
      if (followUp) {
        const lastResponse = this.interactionReplies[this.interactionReplies.length - 1];
        const response: Message<boolean> = await this.interaction.followUp(args);
        this.interactionReplies.push(response);
        return response;
      } else {
        const response: Message<boolean> = await this.interaction.reply(args);
        this.interactionReplies.push(response);
        return response;
      }
    } catch (error) {
      logger.info('Error in respond: ', error);
      throw error;
    }
  }

  public async update(args: any) {
    const parsedInteraction = InteractionProperties.toUpdateableOrUndefined(this.interaction);
    if (parsedInteraction) {
      this._isUpdated = true;
      return await parsedInteraction.update(args);
    } else {
      throw new EndUserError('Interaction is not updatable, so unable to update');
    }
  }

  public async showModal(modalBuilder: ModalBuilder) {
    const parsedInteraction = InteractionProperties.toShowModalOrUndefined(this.interaction);
    if (parsedInteraction) {
      return await parsedInteraction.showModal(modalBuilder);
    } else {
      throw new EndUserError('Interaction cannot show a modal');
    }
  }
}

/**
 * Parent class for all permissions classes.
 * To create a custom permission, the user must subclass this class and implement
 * the hasPermission method. I'm putting it is a class to set subclassing it a requirement,
 * instead of incorporating it with interfaces (properties instead of attribute), as this
 * would incentivize contained classes, simple and focused on the permission check.
 */
export abstract class Permission {
  public abstract hasPermission(interaction: TrackedInteraction): Promise<boolean>;

  /**
   * Specifies a default reponse to reply to the interaction informing the user of a
   * failure meet the permission requirements. For most of the cases, and for the initial
   * version, this will be more than enough, and provides a consistent response in a single
   * place. The views are not obliged to .
   * @param hasPermission
   * @param interaction
   */
  public abstract defaultResponse(hasPermission: boolean, interaction: TrackedInteraction): Promise<InteractionResponse<boolean>>;
}

export abstract class Action {
  public readonly ID: string;
  protected _screen: Screen;

  constructor(screen: Screen, actionId: string) {
    this._screen = screen;
    this.ID = actionId;
    this._screen.registerAction(this, actionId);
  }

  get screen(): Screen {
    return this._screen;
  }

  /**
   * Get a list of all sub-actions for the action, so that they
   * can be registered with the screen. The subclass overrides this method,
   * and returns an array of all the sub-actions, and stores the referrences to the
   * sub-actions locally, so that it can referrence them. The parent screen autoregisters
   * all of the sub-actions with itself.
   */
  public abstract allSubActions(): Action[];

  /**
   * Returns the fully qualified custom_id for the dashboard.
   */
  public get fullCustomId(): string {
    return CustomIDOracle.generateCustomId(this._screen.dashboard, this._screen, this);
  }

  async handleInteraction(interaction: TrackedInteraction): Promise<void> {
    const isValidInteraction = this.isInteractionForSelf(interaction);

    if (!isValidInteraction) {
      await this.handleInvalidInteraction(interaction);
      return;
    }

    const operationId = CustomIDOracle.getOperationId(interaction.customId);

    if (!operationId) {
      await this.handleMissingOperation(interaction);
      return;
    }

    await this.handleOperation(interaction, operationId);
  }

  protected abstract handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void>;

  protected isInteractionForSelf(interaction: TrackedInteraction): boolean {
    const actionId = CustomIDOracle.getActionId(interaction.customId);
    return actionId === this.ID;
  }

  protected async handleInvalidInteraction(interaction: TrackedInteraction): Promise<void> {
    // Implement error handling and redirection to home screen
    throw new EndUserError('Invalid interaction');
  }

  protected async handleInvalidOperation(interaction: TrackedInteraction, operationId: string): Promise<Message<boolean>> {
    return await DiscordStatus.Error.error(interaction, `🤷‍♀️ '${operationId}' operation not found on action ${this.fullCustomId}`);
  }

  protected async handleMissingOperation(interaction: TrackedInteraction): Promise<Message<boolean>> {
    // Re-render the current screen with an error message
    return await DiscordStatus.Error.error(interaction, 'Action operation to perform not found.');
  }

  abstract getComponent(...args: any[]): AnyModalMessageComponent;
}

export abstract class Screen {
  public readonly ID: string;
  protected actions: Map<string, Action> = new Map();
  protected abstract permissions: Permission[];
  public dashboard: Dashboard;

  constructor(dashboard: Dashboard, screenId: string) {
    this.dashboard = dashboard;
    this.ID = screenId;
    this.dashboard.registerScreen(this, screenId);
  }

  /**
   * Get a list of all sub-screens for the screen, so that they
   * can be registered with the dashboard. The subclass overrides this method,
   * and returns an array of all the sub-screens, and stores the referrences to the
   * sub-screens locally, so that it can referrence them. A dashboard autoregisters
   * all of the subcreens.
   */
  protected abstract allSubScreens(): Screen[];

  /**
   * Gets a list of all actions for the screen. The subclass overrides this method,
   * and returns an array of all the actions, and stores the referrences to the actions
   * locally, so that it can referrence them. A screen autoregisters all of the actions.
   */
  protected abstract allActions(): Action[];

  /**
   * Returns the fully qualified custom_id for the screen.
   */
  public get fullCustomId(): string {
    return CustomIDOracle.generateCustomId(this.dashboard, this);
  }

  // TODO: define 'any' type clearly
  protected abstract getResponse(interaction: TrackedInteraction, args?: RenderArgs): Promise<any>;

  /**
   * Send a response to an interaction on the `Screen`. This method must be used for sending custom responses to any interactions
   * on the screen. This ensures that all of the responses of the screen are cleared when the screen is cleared.
   */
  public async render(interaction: TrackedInteraction, args?: RenderArgs): Promise<void> {
    const responseArgs = await this.getResponse(interaction, args);

    try {
      await interaction.respond(responseArgs);
    } catch (error) {
      throw new EndUserError('Error rendering screen', error);
    }
    return;
  }

  public async reRender(interaction: TrackedInteraction, args?: RenderArgs): Promise<void> {
    const responseArgs = await this.getResponse(interaction, args);

    try {
      if (interaction.interaction.isMessageComponent()) {
        await interaction.update(responseArgs);
      } else {
        await interaction.respond(responseArgs);
      }
    } catch (error) {
      throw new EndUserError('Error rendering screen', error);
    }
  }

  /**
   * Checks if the intreaction meets all of the requried permissions.
   * You're unlikely to need to override this.
   * @param interaction
   * @returns
   */
  protected async hasInteractionPermission(interaction: TrackedInteraction): Promise<boolean> {
    for (const permission of this.permissions) {
      if (!(await permission.hasPermission(interaction))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Default response to interaction without sufficient permission.
   * You're unlikely to need to override this.
   * @param interaction
   * @returns
   */
  protected async handlePermissionDeniedResponse(interaction: TrackedInteraction) {
    throw new EndUserError('Insufficient permissions to perform this action.');
  }

  /**
   * Base rules and fow of handling an interaction. Can be overriden by Screen instance subclasses,
   * but probably not needed. If overriden, it's very likely that you want to call super().handleInteraction(interaction),
   * unless you're planning to rewrite the interaction processing logic and implementing all of the parts like actions and
   * permission checks manually.
   * @param interaction
   * @returns
   */
  async handleInteraction(interaction: TrackedInteraction): Promise<void> {
    // 1. Check if the user has permission to interact with the screen
    if (!(await this.hasInteractionPermission(interaction))) {
      // 1.1 If the user does not have permission, instruct the permissionDeniedResponse() method to handle the response.
      // This method can be overriden in the Screen subclass to provide a custom response. This ensures a consistent and
      // out-of-the-box handling of permission checks for every screen and "Permission Denied" responses for all screens.
      await this.handlePermissionDeniedResponse(interaction);
      return;
    }

    // 2. Get the action ID, to know to which action the interaction should be routed to
    const actionId = CustomIDOracle.getActionId(interaction.customId);
    if (!actionId) {
      // 2.1 If the custom_id is in the format DISCORD_ID:SCREEN_ID, then this interaction is for the screen itself
      await this.render(interaction);
      return;
    }
    // At this point we know that the interaction is directed towards an action, but we don't know if that action
    // exists in the set of actions for the screen.
    // 3. Get the action by the ID obtained from custom_id
    const action = this.getAction(actionId);
    if (action) {
      // 3.1 If action is found in the set of screen's actions, then route the interaction to the action
      await action.handleInteraction(interaction);
    } else {
      // 3.2 If action is not found, then reply to the interaction with an error message
      await interaction.respond({ content: `Invalid action '${actionId}' for screen '${this.ID}'`, ephemeral: true });
    }
  }

  protected getAction(actionId: string): Action | undefined {
    return this.actions.get(actionId);
  }

  public registerAction(action: Action, actionId: string): void {
    this.actions.set(actionId, action);
    //logger.info(`Action registered: ${actionId}`);
    //logger.info(action);
  }
}

export abstract class Dashboard {
  public readonly ID: string;
  protected screens: Map<string, Screen> = new Map();
  protected _homeScreen: HomeScreen | undefined;
  protected routes: Dashboard[] = [];

  constructor(dashBoardId: string, routes?: Dashboard[]) {
    this.ID = dashBoardId;

    if (routes) {
      this.routes = routes;
    }
  }

  /**
   * If no matching dashboards are round, .isFallBack() will be called on them one-by-one, until one of them returns true.
   * This dashboard will then be used to handle the interaction.
   *
   * Default implementation returns false, but you can override it in the subclass.
   */
  public async isFallback(interaction: TrackedInteraction): Promise<boolean> {
    return false;
  }

  /**
   * Returns the fully qualified custom_id for the dashboard.
   */
  public get fullCustomId(): string {
    return CustomIDOracle.generateCustomId(this);
  }

  public set homeScreen(screen: HomeScreen) {
    this._homeScreen = screen;
  }

  public get homeScreen(): HomeScreen | undefined {
    return this._homeScreen;
  }

  async handleInteraction(interaction: TrackedInteraction): Promise<void> {
    if (!this._homeScreen) {
      throw new EndUserError('Home screen not set.');
    }

    logger.info('[Dashboard] Handling interaction ', interaction.customId);

    const screenId = CustomIDOracle.getScreenId(interaction.customId);
    if (!screenId) {
      await this._homeScreen.render(interaction);
      return;
    }

    // 1. Try to get the screen in this dashboard
    let screen = this.getScreen(screenId);

    // 2. If screen is not found in this dashboard, try to find it in the routes
    if (!screen) {
      for (const route of this.routes) {
        screen = route.getScreen(screenId);
        if (screen) {
          logger.debug(`Screen '${screenId}' found in routed dashboard '${route.ID}'`);
          break;
        }
      }
    }

    if (screen) {
      await screen.handleInteraction(interaction);
    } else {
      const { DiscordStatus } = await import('../channels/DiscordStatus');
      await DiscordStatus.Error.error(interaction, `Screen '${screenId}' not found in dashboard '${this.ID}'`);

      const allRegisteredScreens = Array.from(this.screens.keys());
      let allRoutedScreens: string[] = [];

      for (const route of this.routes) {
        allRoutedScreens = allRoutedScreens.concat(Array.from(route.screens.keys()));
      }

      logger.error(
        `Screen '${screenId}' not found in dashboard '${this.ID}.\nRegistered screens: ${allRegisteredScreens}.\nRouted screens: ${allRoutedScreens}`,
      );
      throw new EndUserError(`Screen '${screenId}' not found in dashboard '${this.ID}'`);
    }
  }

  public getScreen(screenId: string): Screen | undefined {
    return this.screens.get(screenId);
  }

  public registerScreen(screen: Screen, screenId: string): void {
    if (!screenId) {
      throw new EndUserError(`Failed to add screen to dashboard ${this.ID}. Screen ID not set.`);
    }

    this.screens.set(screenId, screen);
  }
}
