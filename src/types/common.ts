import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';

export type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

type NonDMChannel = TextChannel | NewsChannel | ThreadChannel;

export type AnyNamedChannelInteraction = AnyInteraction & { channel: NonDMChannel };
export type AnyInteractionWithUpdate = AnyInteraction & { update(...args: any[]): any };

export interface PermissionChecker {
  (interaction: AnyInteraction): Promise<boolean>;
}

export interface RenderOptions {
  interaction: AnyInteraction;
  [key: string]: any;
}