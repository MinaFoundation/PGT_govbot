import type { Dashboard, Screen, Action, TrackedInteraction } from './core/BaseClasses';
import { InteractionProperties } from './core/Interaction';
import { EndUserError } from './Errors';
import logger from './logging';
import { AnyInteractionWithValues } from './types/common';


export class CustomIDOracle {
  static readonly SEPARATOR = ':';
  static readonly MAX_LENGTH = 100;

  static generateCustomId(dashboard: Dashboard, screen?: Screen, action?: Action, operation?: string, ...args: string[]): string {
    const parts = [dashboard.ID];

    if (screen) {
      parts.push(screen.ID);
    }
    
    if (action) {
      parts.push(action.ID);
    }
    
    if (operation) {
      parts.push(operation);
    }
    
    parts.push(...args);
    
    const customId = parts.join(this.SEPARATOR);
    
    if (customId.length > this.MAX_LENGTH) {
      throw new EndUserError(`CustomId length of ${customId.length} exceeds the maximum allowed value of ${this.MAX_LENGTH} characters.`);
    }
    
    return customId;
  }

  static customIdFromRawParts(dashboardId: string, screenId?: string, actionId?: string, operationId?: string, ...args: string[]): string {
    const parts = [dashboardId];

    if (screenId) {
      parts.push(screenId);
    }
    
    if (actionId) {
      parts.push(actionId);
    }
    
    if (operationId) {
      parts.push(operationId);
    }
    
    parts.push(...args);
    
    const customId = parts.join(this.SEPARATOR);
    
    if (customId.length > this.MAX_LENGTH) {
      throw new EndUserError(`CustomId length of ${customId.length} exceeds the maximum allowed value of ${this.MAX_LENGTH} characters.`);
    }
    
    return customId;
  }

  static addArgumentsToAction(action: Action, operation?: string, ...args: string[]): string {
    if (args.length % 2 !== 0) {
      throw new EndUserError('Arguments must be key-value pairs');
    }
    const customId = this.generateCustomId(action.screen.dashboard, action.screen, action, operation);

    const outputCustomId: string = `${customId}${this.SEPARATOR}${args.join(this.SEPARATOR)}`;

    if (outputCustomId.length > this.MAX_LENGTH) {
      throw new EndUserError(`Custom ID exceeds maximum length of ${this.MAX_LENGTH} characters by ${outputCustomId.length - this.MAX_LENGTH} characters`);
    }

    return outputCustomId;
  }

  static getNamedArgument(customId: string, argName: string): string | undefined {
    const args = this.getArguments(customId);
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] === argName) {
        return args[i + 1];
      }
    }
    return undefined;
  }

  static parseCustomId(customId: string): string[] {
    return customId.split(this.SEPARATOR);
  }

  static getDashboardId(customId: string): string {
    return this.parseCustomId(customId)[0];
  }

  static getScreenId(customId: string): string {
    return this.parseCustomId(customId)[1];
  }

  static getActionId(customId: string): string | undefined {
    return this.parseCustomId(customId)[2];
  }

  static getOperationId(customId: string): string | undefined {
    return this.parseCustomId(customId)[3];
  }

  static getArguments(customId: string): string[] {
    return this.parseCustomId(customId).slice(4);
  }
}

/**
 * Oracle that retrieves arguments from all of the available sources:
 * - Custom ID
 * - Interaction Context (`TrackedIntraction.Context`)
 * - Interaction Values (optional)
 */
export class ArgumentOracle {

  static COMMON_ARGS = {
    FUNDING_ROUND_ID: 'fundingRoundId',
    PHASE: 'phase',
  }

  static getNamedArgument(intreaction: TrackedInteraction, argName: string, valuesIndex?:number): string {
    const argFromCustomId: string | undefined = CustomIDOracle.getNamedArgument(intreaction.customId, argName);
    
    if (argFromCustomId) {
      logger.debug(`Found argument ${argName} in custom ID: ${argFromCustomId}`);
      return argFromCustomId.toLowerCase();
    }

    const argFromContext: string | undefined = intreaction.Context.get(argName);
    if (argFromContext) {
      logger.debug(`Found argument ${argName} in context: ${argFromContext}`);
      return argFromContext.toLowerCase();
    }

    if (valuesIndex !== undefined) {
      const parsedInteraction: AnyInteractionWithValues = InteractionProperties.toInteractionWithValuesOrError(intreaction.interaction);
      const argFromValues: string | undefined = parsedInteraction.values[valuesIndex];
      if (argFromValues) {
        logger.debug(`Found argument ${argName} in values: ${argFromValues}`);
        return argFromValues.toLowerCase();
      } else {
        throw new EndUserError(`Argument ${argName} not found in custom ID, context or values.`);
      }
    }

    throw new EndUserError(`Argument ${argName} not found in custom ID or context.`);
  }
} 