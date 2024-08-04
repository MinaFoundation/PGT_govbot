import type { Dashboard, Screen, Action } from './core/BaseClasses';
import { EndUserError } from './Errors';

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
      throw new EndUserError(`Custom ID exceeds maximum length of ${this.MAX_LENGTH} characters`);
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
      throw new EndUserError(`Custom ID exceeds maximum length of ${this.MAX_LENGTH} characters`);
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