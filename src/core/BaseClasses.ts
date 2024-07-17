// src/core/BaseClasses.ts

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import { AnyInteraction, PermissionChecker, RenderOptions } from '../types/common';

export type ScreenConstructor<T extends Screen = Screen> = new (...args: any[]) => T;


export abstract class Dashboard {
    static readonly CUSTOM_ID_PREFIX: string = 'DA';
    protected screens: Map<string, Screen> = new Map();
    protected readonly DEFAULT_VIEW_PERMISSION: PermissionChecker = async (interaction: AnyInteraction) => true;

    public readonly homeScreen: Screen;

    constructor(homeScreen: ScreenConstructor) {
        // home screen is setup with the same permission as the dashboard
        this.homeScreen = new homeScreen(this, this.DEFAULT_VIEW_PERMISSION);
        this.registerScreen(this.homeScreen);

    }
    
    abstract render(interaction: AnyInteraction): Promise<void>;
    
    protected async renderNoPermissionMessage(interaction: AnyInteraction): Promise<void> {

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⛔ Access Denied')
            .setDescription('You do not have permission to view this dashboard.');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('tryAgain')
                    .setLabel('Try Again')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }


    protected registerScreen(screen: Screen): void {
        this.screens.set(screen.customIdPrefix(), screen);
    }

    public getScreen(screenId: string): Screen | undefined {
        return this.screens.get(screenId);
    }

    public renderHomeScreen(channel: TextChannel): void {
        this.homeScreen.renderInitial(channel);
    }
}

export abstract class Screen {
    static readonly CUSTOM_ID_PREFIX: string = 'SC';
    static readonly SCREEN_ID: string = 'base'
    protected actions: Map<string, Action> = new Map();
    public readonly dashboard: Dashboard;
    protected viewPermission: PermissionChecker;
  
    constructor(dashboard: Dashboard, viewPermission: PermissionChecker) {
      this.dashboard = dashboard;
      this.viewPermission = viewPermission;
    }

    async renderInitial(channel: TextChannel): Promise<void> {
        throw new Error('Method not implemented.');     
    }
    
  
    async render(options: RenderOptions): Promise<void> {
      const { interaction } = options;
      if (!await this.viewPermission(interaction)) {
        await this.renderNoPermissionMessage(interaction);
        throw new Error('User has not permission to view this screen.');
      }
    }
  
    protected async renderNoPermissionMessage(interaction: AnyInteraction): Promise<void> {
      const { EmbedBuilder } = require('discord.js');
      
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⛔ Access Denied')
        .setDescription('You do not have permission to view this screen.');
    }

    customIdPrefix(): string {
        return Screen.CUSTOM_ID_PREFIX;
    }

    screenId(): string {
        return Screen.SCREEN_ID;
    }

    instance(): Screen {
        return this;
    }

    registerAction(action: Action): void {
        this.actions.set(action.ACTION_ID, action);
    }

    getAction(actionId: string): Action | undefined {
        return this.actions.get(actionId);
    }

    static generateCustomId(actionId: string, ...args: string[]): string {
        return `${this.CUSTOM_ID_PREFIX}:${this.SCREEN_ID}:${actionId}${args.length > 0 ? `:${args.join(':')}` : ''}`;
    }
}

export abstract class Action {
    static readonly CUSTOM_ID_PREFIX: string = 'AC';
    static readonly ACTION_ID: string;
    protected screen: Screen;

    constructor(screen: Screen) {
        this.screen = screen;
    }

    get CUSTOM_ID_PREFIX(): string {
        return Action.CUSTOM_ID_PREFIX;
    }

    get ACTION_ID(): string {
        return Action.ACTION_ID;
    }

    execute(interaction: AnyInteraction): Promise<void> {
        throw new Error('Method not implemented.');
    }

    static generateCustomId(...args: string[]): string {
        return `${this.CUSTOM_ID_PREFIX}:${this.ACTION_ID}${args.length > 0 ? `:${args.join(':')}` : ''}`;
    }

}