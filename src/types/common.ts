//src/types/common.ts

import type { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, TextChannel, NewsChannel, ThreadChannel, AnyComponentBuilder, ModalComponentBuilder, MessageComponentBuilder, Message, MessageComponentInteraction } from 'discord.js';
import type {Screen} from '../core/BaseClasses';
export type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | MessageComponentInteraction;

type NonDMChannel = TextChannel | NewsChannel | ThreadChannel;

export type AnyNamedChannelInteraction = AnyInteraction & { channel: NonDMChannel };
export type AnyInteractionWithUpdate = AnyInteraction & { update(...args: any[]): any };
export type AnyInteractionWithShowModal = AnyInteraction & { showModal(...args: any[]): any };
export type AnyIntreactionWithFields = AnyInteraction & { fields: any };
export type AnyInteractionWithDefinedChannel = AnyInteraction & { channel: NonDMChannel };
export type AnyInteractionWithValues = StringSelectMenuInteraction;


export interface PermissionChecker {
  (interaction: AnyInteraction): Promise<boolean>;
}

export interface RenderOptions {
  interaction: AnyInteraction;
  isFollowUp?: boolean;
  isPreserved?: boolean;
  [key: string]: any;
}

export interface IHomeScreen {
  renderToTextChannel(channel: TextChannel): Promise<void>;
}
export type HomeScreen = Screen & IHomeScreen;

export type AnyModalMessageComponent =  AnyComponentBuilder | ModalComponentBuilder | MessageComponentBuilder;